import { useEffect, useState } from "react";

type VanityRecord = {
  callerNumber: string;
  vanityNumbers: string[];
  timestamp?: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "https://your-api-url-here";

function App() {
  const [calls, setCalls] = useState<VanityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentCallers = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/recent-callers`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        // Adjust this if your Lambda returns { items: [...] }
        setCalls(data);
      } catch (err: any) {
        setError(err.message ?? "Failed to load callers");
      } finally {
        setLoading(false);
      }
    };

    fetchRecentCallers();
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Recent Vanity Calls</h1>

      {loading && <p>Loading recent callers…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && calls.length === 0 && (
        <p>No recent callers found.</p>
      )}

      {!loading && !error && calls.length > 0 && (
        <table
          style={{
            borderCollapse: "collapse",
            marginTop: "1rem",
            minWidth: "600px",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Caller Number</th>
              <th style={thStyle}>Top Vanity Numbers</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call, index) => (
              <tr key={index}>
                <td style={tdStyle}>
                  {call.timestamp
                    ? new Date(call.timestamp).toLocaleString()
                    : "—"}
                </td>
                <td style={tdStyle}>{call.callerNumber}</td>
                <td style={tdStyle}>
                  {call.vanityNumbers && call.vanityNumbers.length > 0 ? (
                    <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
                      {call.vanityNumbers.slice(0, 5).map((vn, i) => (
                        <li key={i}>{vn}</li>
                      ))}
                    </ul>
                  ) : (
                    "No vanity numbers stored"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  borderBottom: "1px solid #ccc",
  textAlign: "left",
  padding: "0.5rem 0.75rem",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "0.5rem 0.75rem",
};

export default App;
