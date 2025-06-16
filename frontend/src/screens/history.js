import React, { useEffect, useState } from "react";
import axios from "axios";
import utils from "../components/Utils";
import {
  Container,
  Grid,
  Button,
  TextField,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";

const History = () => {
  const [cardID, setCardID] = useState("");
  const [employeeID, setEmployeeID] = useState("");
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [onlineTotal, setOnlineTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);

  useEffect(() => {
    utils.checkLoginCredentials();
    calculateTotals();
  }, [historyData]);

  const calculateTotals = () => {
    let online = 0,
      cash = 0,
      totalAmount = 0;

    historyData.forEach((history) => {
      const amount = Number(history.Amount);
      totalAmount += amount;
      if (history.Method === "ONLINE") {
        online += amount;
      } else if (history.Method === "CASH") {
        cash += amount;
      }
    });

    setOnlineTotal(online.toFixed(2));
    setCashTotal(cash.toFixed(2));
    setTotal(totalAmount.toFixed(2));
  };

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get("http://localhost:5000/api/admin/history", {
        params: {
          cardID: cardID || undefined,
          empID: employeeID || undefined,
        },
      });

      const data = response.data.data || [];
      setHistoryData(data);

      if (data.length === 0) {
        setError("No history found for the selected criteria.");
      }
    } catch (err) {
      setError("An error occurred while fetching data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");

    socket.onopen = () => {
      console.log("Connected to WebSocket server");
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.uid) {
        setCardID(data.uid);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <Container maxWidth="md" style={{ marginTop: "20px" }}>
      <Typography variant="h4" gutterBottom align="center" style={{ fontStyle: "oblique" }}>
        {total > 0 ? "Transaction Report" : "History"}
      </Typography>

      {total > 0 && (
        <Box display="flex" justifyContent="center" gap={5} marginBottom={2}>
          <Typography variant="h5" style={{ fontSize: 18, fontStyle: "italic", color: "green" }}>
            Cash: {cashTotal}
          </Typography>
          <Typography variant="h5" style={{ fontSize: 18, fontStyle: "italic", color: "green" }}>
            Online: {onlineTotal}
          </Typography>
          <Typography variant="h5" style={{ fontSize: 18, fontStyle: "italic", color: "green" }}>
            Total: {total}
          </Typography>
        </Box>
      )}

      <Grid container spacing={2} justifyContent="center" alignItems="center">
        <Grid item xs={6}>
          <TextField
            label="Employee ID"
            variant="outlined"
            fullWidth
            value={employeeID}
            onChange={(e) => setEmployeeID(e.target.value)}
          />
        </Grid>
        <Grid item xs={4} style={{ display: "flex", alignItems: "center" }}>
          <TextField
            label="Card ID"
            variant="outlined"
            fullWidth
            value={cardID}
            readOnly
            onChange={(e) => setCardID(e.target.value)}
          />
          <Button variant="contained" color="success" style={{ marginLeft: "10px" }}>
            Scan
          </Button>
        </Grid>

        <Grid item xs={12} style={{ textAlign: "center" }}>
          <Button variant="contained" color="primary" onClick={fetchHistory} size="medium">
            Fetch Data
          </Button>
        </Grid>
      </Grid>

      {/* Transaction Table */}
      <TableContainer component={Paper} style={{ marginTop: "20px" }}>
        <Table>
          <TableHead>
            <TableRow style={{ background: "#1976d2" }}>
              <TableCell style={{ color: "#fff", fontWeight: "bold" }}>Transaction ID</TableCell>
              <TableCell style={{ color: "#fff", fontWeight: "bold" }}>Card ID</TableCell>
              <TableCell style={{ color: "#fff", fontWeight: "bold" }}>Amount</TableCell>
              <TableCell style={{ color: "#fff", fontWeight: "bold" }}>Type</TableCell>
              <TableCell style={{ color: "#fff", fontWeight: "bold" }}>Employee ID</TableCell>
              <TableCell style={{ color: "#fff", fontWeight: "bold" }}>Method</TableCell>
              <TableCell style={{ color: "#fff", fontWeight: "bold" }}>Transaction Time</TableCell>
              <TableCell style={{ color: "#fff", fontWeight: "bold" }}>Remarks</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} align="center" style={{ color: "red" }}>
                  {error}
                </TableCell>
              </TableRow>
            ) : (
              historyData.map((transaction) => (
                <TableRow key={transaction.TransactionID}>
                  <TableCell>{transaction.TransactionID}</TableCell>
                  <TableCell>{transaction.CardID}</TableCell>
                  <TableCell>₹{transaction.Amount}</TableCell>
                  <TableCell
                    style={{
                      color: transaction.Type === "credit" ? "green" : "red",
                      fontWeight: "bold",
                    }}
                  >
                    {transaction.Type}
                  </TableCell>
                  <TableCell>{transaction.EmployeeID || "N/A"}</TableCell>
                  <TableCell>{transaction.Method}</TableCell>
                  <TableCell>{new Date(transaction.FormattedTransactionTime).toLocaleString()}</TableCell>
                  <TableCell>{transaction.Remarks || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default History;
