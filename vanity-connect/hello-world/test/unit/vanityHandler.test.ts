import { lambdaHandler } from "../../src/app";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

describe("Vanity Connect lambdaHandler", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, TABLE_NAME: "TestTable" };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("1. should process a valid caller and write a record", async () => {
    // a. Arrange – valid-looking Amazon Connect event
    const event = {
      Details: {
        ContactData: {
          CustomerEndpoint: {
            Address: "+13035551212",
          },
        },
      },
    };

    const sendMock = jest
      .spyOn(DynamoDBDocumentClient.prototype as any, "send")
      .mockResolvedValue({});

    // b. Act
    const result = await lambdaHandler(event as any);

    // c. Assert – success returns speechText for Connect to speak
    expect(result).toBeDefined();
    const asAny = result as any;
    expect(asAny.speechText).toEqual(expect.any(String));
    expect(asAny.speechText).toContain("Here are your top three vanity number options");

    // DynamoDB should have been called at least once to persist the call
    expect(sendMock).toHaveBeenCalled();

    sendMock.mockRestore();
  });

  test("2. should return error object when caller data is missing/invalid", async () => {
    // a. Arrange – fully missing Details so it’s clearly invalid
    const event = {};

    const sendMock = jest
      .spyOn(DynamoDBDocumentClient.prototype as any, "send")
      .mockResolvedValue({});

    const expectedErrorStart = {
      error: "true",
    };

    // b. Act
    const result = await lambdaHandler(event as any);

    // c. Assert – error response shape
    expect(result).toBeDefined();
    const asAny = result as any;
    expect(asAny).toMatchObject(expectedErrorStart);
    expect(asAny.speechText).toContain(
      "Sorry, an error occurred while generating your vanity numbers."
    );

    // We won't assert on Dynamo behavior here since the implementation
    // may or may not attempt a write before failing – we're focused on the response.
    sendMock.mockRestore();
  });

  test("3. should return error object when DynamoDB write fails", async () => {
    // a. Arrange – valid caller but DynamoDB throws
    const event = {
      Details: {
        ContactData: {
          CustomerEndpoint: {
            Address: "+13035551212",
          },
        },
      },
    };

    const sendMock = jest
      .spyOn(DynamoDBDocumentClient.prototype as any, "send")
      .mockRejectedValue(new Error("DDB error"));

    const expectedErrorStart = {
      error: "true",
    };

    // b. Act
    const result = await lambdaHandler(event as any);

    // c. Assert – handler returns the generic error speech
    expect(result).toBeDefined();
    const asAny = result as any;
    expect(asAny).toMatchObject(expectedErrorStart);
    expect(asAny.speechText).toContain(
      "Sorry, an error occurred while generating your vanity numbers."
    );

    // At least one attempt to call DynamoDB should have been made
    expect(sendMock.mock.calls.length).toBeGreaterThanOrEqual(1);

    sendMock.mockRestore();
  });
});
