/**
 * ---------------------------------------------------------
 *  File:        app.ts
 *  Description: 
 *
 *  Author:      Michael Gutierrez
 *  Created:     11/30/2025
 *
 *  Notes:
 *    - 
 * ---------------------------------------------------------
 */


import {DynamoDBClient,} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient,PutCommand,ScanCommand,} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyResult } from "aws-lambda";

//Vanity record has the partition key of CALL so that the record is grouped in Dynamo DB
//Timestamp is used as the sort key so that we can meet the front end requirement of showing the most recent callers. 
type VanityRecord = {
  pk: "CALL";
  sk: string; // ISO timestamp
  callerNumber: string;
  vanityNumbers: string[];
};

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME ?? "";

// Vanity Lambda - invoked by Amazon Connect contact flow
export const lambdaHandler = async (event: any): Promise<any> => {
  try {
    // Amazon Connect sends caller number in this path:
    const callerRaw =
      event?.Details?.ContactData?.CustomerEndpoint?.Address ?? "";
    const callerNumber = normalizePhone(callerRaw);

    if (!callerNumber) {
      throw new Error("Invalid caller number");
    }

    const vanityNumbers = generateBestVanityNumbers(callerNumber);
    const now = new Date().toISOString();

    const record: VanityRecord = {
      pk: "CALL",
      sk: now,
      callerNumber,
      vanityNumbers,
    };
    //Await so the method doesn't return before teh write is completed.
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: record,
      })
    );
  
  // We use the regular expression /\d.\.test(char) to see if the character is an integer so that it can be read as a single digit
  // The voice will also pause on hyphen for .2 seconds so that it reads more clearly to the caller. 
  function spellOutMixed(str: string): string {
    return [...str]
      .map(char => {
        if (/\d/.test(char)) return `${char} `;
        if (char === '-') return ' <break time="200ms"/> ';
        return char;
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // top 3 returned for Connect to speak
  const [v1 = "", v2 = "", v3 = ""] = vanityNumbers;

  const spokenV1 = spellOutMixed(v1);
  const spokenV2 = spellOutMixed(v2);
  const spokenV3 = spellOutMixed(v3);

  const speechText =
    `Here are your top three vanity number options. ` +
    `Option one: ${spokenV1}. ` +
    `Option two: ${spokenV2}. ` +
    `Option three: ${spokenV3}. ` +
    `Thank you for calling. Goodbye.`;

  return {
    vanity1: v1,
    vanity2: v2,
    vanity3: v3,
    speechText,
  };
  } catch (err) {
    console.error("Error in vanity lambda", err);
    // Simple, caller-safe error shape
    return {
      vanity1: "",
      vanity2: "",
      vanity3: "",
      speechText: "Sorry, an error occurred while generating your vanity numbers.",
      error: "true",
    };
  }
};

// 2) GetRecentCallers - HTTP endpoint for last 5 callers
export const getRecentCallers = async (): Promise<APIGatewayProxyResult> => {
  try {
    if (!TABLE_NAME) {
      throw new Error("TABLE_NAME env var is not set");
    }

    // Scan the table and filter by pk = "CALL"
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": "CALL",
        },
      })
    );

    const items = (res.Items ?? []) as any[];

    // Sort newest first by sk (ISO timestamp string)
    items.sort((a, b) => {
      if (a.sk < b.sk) return 1;
      if (a.sk > b.sk) return -1;
      return 0;
    });

    const last5 = items.slice(0, 5).map((item) => ({
      callerNumber: item.callerNumber,
      vanityNumbers: item.vanityNumbers,
      calledAt: item.sk,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(last5),
      headers: {
        "Content-Type": "application/json",
      },
    };
  } catch (err) {
    console.error("Error in getRecentCallers", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};


// ---- Helpers ----
// potentially move these functions to another file for better orgnanzation. 

// T9 digit -> letters mapping
const T9_MAP: Record<string, string> = {
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
};
// Temporary "dictionary" for possible vanitys
const CANDIDATE_WORDS: string[] = [
  "CALL",
  "HELP",
  "HOME",
  "SALE",
  "DEAL",
  "PIZZA",
  "TECH",
  "CLOUD",
  "AWS",
  "SERVICE",
  "SUPPORT",
  "COACH",
  "LEGAL",
  "QUOTE",
  // ...etc
];

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Use last 10 digits as local number
  return digits.slice(-10);
}

// TODO: In the "real world", implement full T9 mapping + dictionary-based scoring.
function generateBestVanityNumbers(phone: string): string[] {
  const area = phone.slice(0, 3);
  const prefix = phone.slice(3, 6);
  const line = phone.slice(6);

  

  return [
    `${area}-${prefix}-CALL`,
    `${area}-${prefix}-HELP`,
    `${area}-${prefix}-AWSX`,
    `${area}-${prefix}-${line}`,
    phone,
  ];
}
