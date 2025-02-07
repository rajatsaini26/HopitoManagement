import React, { useEffect, useState } from 'react';
import axios from 'axios';
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
import utils from '../components/Utils';

const Transactions = () => {
    const [filter, setFilter] = useState('today');
    const [transactionData, setTransactionData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [Total, setTotal] = useState();
    const [onlineTotal, setOnlineTotal] = useState();
    const [Cash, setCash] = useState();

    useEffect(() => {
            utils.checkLoginCredentials();

        const calculations = () => {
            let onlineTotal = 0;
            let cashTotal = 0;
            let total = 0;

            transactionData.forEach(transaction => {
                const amount = Number(transaction.Amount); 
                total += amount;
                if (transaction.Method === 'ONLINE') {
                    onlineTotal += amount;
                } else if (transaction.Method === 'CASH') {
                    cashTotal += amount;
                }
            });

            setOnlineTotal(onlineTotal.toFixed(2));
            setCash(cashTotal.toFixed(2)); 
            setTotal(total.toFixed(2)); 
        }
        calculations();
    }, [transactionData]);

    const fetchTransactionHistory = async (filterValue) => {
        console.log(filterValue)
        setLoading(true);
        setError(null);
        try {
            
            const response = await axios.get('http://localhost:5000/api/admin/transactions', {
                params: { filter: filterValue },
            });
            // Set transaction data from API response
            const transactions = response.data.data || [];
            setTransactionData(transactions);
            if (response.data.length === 0) {
                setError('No transactions found for the selected date range.');
            }
        } catch (err) {
            setError('An error occurred while fetching data.');
        } finally {
            setLoading(false);
        }
    };

    const handleTodayReport = () => {
        fetchTransactionHistory('today');
    };

    const handleFilterChange = (event) => {
        setFilter(event.target.value);
    };

    const handleSubmit = () => {
        if (filter) {
            fetchTransactionHistory(filter);
        } else {
            setError('Please select a valid filter.');
        }
    };

    return (
        <Container maxWidth="md" style={{ marginTop: '20px' }}>
            {(Total==0.00)&&(
                <Typography variant="h4" gutterBottom align="center" style={{ fontStyle: 'oblique' }}>
                Sales Report
            </Typography>
            )}
            {(Total>0.00 )&& (
                <div>
                    <Typography variant="h5" gutterBottom align="center" style={{ fontSize: 28, fontStyle: 'italic', color: 'green', display: 'inline-block', marginRight: '80px' }}>
                        Cash: {Cash}
                    </Typography>
                    <Typography variant="h5" gutterBottom align="center" style={{ fontSize: 28, fontStyle: 'italic', color: 'green', display: 'inline-block', marginInline: '80px' }}>
                        Online: {onlineTotal}
                    </Typography>
                    <Typography variant="h5" gutterBottom align="center" style={{ fontSize: 28, fontStyle: 'italic', color: 'green', display: 'inline-block' }}>
                        Total: {Total}
                    </Typography>

                </div>
            )}

            {/* Filter selection */}
            <Grid container spacing={3} justifyContent="center" alignItems="center">
                <Grid item xs={12} sm={6} md={4}>
                    <TextField

                        variant="outlined"
                        fullWidth
                        select
                        value={filter}
                        onChange={handleFilterChange}
                        SelectProps={{
                            native: true,
                        }}
                        style={{ marginBottom: '20px' }}
                    >
                        <option value="today">Today</option>
                        <option value="monthly">This Month</option>
                        <option value="6months">Last 6 Months</option>
                        <option value="yearly">This Year</option>
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSubmit}
                        fullWidth
                        style={{ marginBottom: '20px' }}
                    >
                        Fetch Data
                    </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>

                </Grid>
            </Grid>

            {/* Error message */}
            {error && (
                <Box style={{ marginTop: '20px' }}>
                    <Typography variant="body1" color="error" align="center">
                        {error}
                    </Typography>
                </Box>
            )}

            {/* Transaction History Table */}
            {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" style={{ marginTop: '30px' }}>
                    <CircularProgress />
                </Box>
            ) : (
                transactionData.length > 0 && (
                    <TableContainer component={Paper} style={{ marginTop: '30px' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell style = {{fontWeight:"600", fontSize:16 , color:'white'}}>Transaction ID</TableCell>
                                    <TableCell style = {{fontWeight:"600", fontSize:16 , color:'white'}}>Card</TableCell>
                                    <TableCell style = {{fontWeight:"600", fontSize:16 , color:'white'}}>Amount</TableCell>
                                    <TableCell style = {{fontWeight:"600", fontSize:16 , color:'white'}}>Type</TableCell>
                                    <TableCell style = {{fontWeight:"600", fontSize:16 , color:'white'}}>Employee/Game</TableCell>
                                    <TableCell style = {{fontWeight:"600", fontSize:16 , color:'white'}}>Date</TableCell>

                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {transactionData.map((transaction) => (
                                    <TableRow key={transaction.TransactionID}>
                                        <TableCell style={{fontWeight:"600", fontSize:15, textAlign:'center'}}>{transaction.TransactionID}</TableCell>
                                        <TableCell style={{fontWeight:"600", fontSize:15, textAlign:'center'}}>{transaction.CardID}</TableCell>
                                        <TableCell style={{fontWeight:"600", fontSize:15, textAlign:'center'}}><div>{transaction.Amount}</div><div>{transaction.Method}</div></TableCell>
                                        <TableCell style={{fontWeight:"600", fontSize:15, textAlign:'center'}}>{transaction.Type}</TableCell>
                                        <TableCell style={{fontWeight:"600", fontSize:15, textAlign:'center'}}>{transaction.EmployeeID ||transaction.GameID }</TableCell>
                                        <TableCell style={{fontWeight:"600", fontSize:15, textAlign:'center'}}>
                                            <div>{new Date(transaction.TransactionTime).toLocaleDateString()}</div>
                                            <div>{new Date(transaction.TransactionTime).toLocaleTimeString()}</div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )
            )}
        </Container>
    );
};

export default Transactions;
