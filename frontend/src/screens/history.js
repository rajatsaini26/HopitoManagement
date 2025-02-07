import React, { useEffect, useState } from 'react';
import axios from 'axios';
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
    CircularProgress,
} from '@mui/material';

const History = () => {
    const [filter, setFilter] = useState('today');
    const [cardID, setCardID] = useState('');
    const [employeeID, setEmployeeID] = useState('');
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [total, setTotal] = useState(0);
    const [onlineTotal, setOnlineTotal] = useState(0);
    const [cashTotal, setCashTotal] = useState(0);

    useEffect(() => {
            utils.checkLoginCredentials();

        const calculations = () => {
            let online = 0, cash = 0, totalAmount = 0;

            historyData.forEach(history => {
                const amount = Number(history.Amount);
                totalAmount += amount;
                if (history.Method === 'ONLINE') {
                    online += amount;
                } else if (history.Method === 'CASH') {
                    cash += amount;
                }
            });

            setOnlineTotal(online.toFixed(2));
            setCashTotal(cash.toFixed(2));
            setTotal(totalAmount.toFixed(2));
        };

        calculations();
    }, [historyData]);

    const fetchHistory = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get('http://localhost:5000/api/admin/history', {
                params: {
                    cardID: cardID || undefined,
                    empID: employeeID || undefined
                },
            });

            const data = response.data.data || [];
            setHistoryData(data);

            if (data.length === 0) {
                setError('No history found for the selected criteria.');
            }
        } catch (err) {
            setError('An error occurred while fetching data.');
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
            console.log(data);
            if (data.uid && data.location) {
                console.log(`UID: ${data.uid}, Location: ${data.location}`);
                setCardID(data.uid);
            } else {
                console.error("Received data in unexpected format:", data);
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
        <Container maxWidth="md" style={{ marginTop: '20px' }}>
            <Typography variant="h4" gutterBottom align="center" style={{ fontStyle: 'oblique' }}>
                {total > 0 ? 'Transaction Report' : 'History'}
            </Typography>

            {total > 0 && (
                <Box display="flex" justifyContent="center" gap={5} marginBottom={2}>
                    <Typography variant="h5" style={{ fontSize: 18, fontStyle: 'italic', color: 'green' }}>
                        Cash: {cashTotal}
                    </Typography>
                    <Typography variant="h5" style={{ fontSize: 18, fontStyle: 'italic', color: 'green' }}>
                        Online: {onlineTotal}
                    </Typography>
                    <Typography variant="h5" style={{ fontSize: 18, fontStyle: 'italic', color: 'green' }}>
                        Total: {total}
                    </Typography>
                </Box>
            )}

            <Grid container spacing={2} justifyContent="center" alignItems="center">
                <Grid item xs={4}>
                    <TextField
                        label="Employee ID"
                        variant="outlined"
                        fullWidth
                        value={employeeID}
                        onChange={(e) => setEmployeeID(e.target.value)}
                    />
                </Grid>
                <Grid item xs={4} style={{ display: 'flex', alignItems: 'center' }}>
                    <TextField
                        label="Card ID"
                        variant="outlined"
                        fullWidth
                        value={cardID}
                        readonly
                        onChange={(e) => setCardID(e.target.value)}
                    />
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => console.log('Scanning Card...')}
                        style={{ marginLeft: '10px' }}
                    >
                        Scan
                    </Button>
                </Grid>
                
                <Grid item xs={12} style={{ textAlign: 'center' }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={fetchHistory}
                        size="medium"
                    >
                        Fetch Data
                    </Button>
                </Grid>
            </Grid>
        </Container>
    );
};

export default History;
