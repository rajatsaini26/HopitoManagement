import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AboutScreen from "../screens/AboutScreen";
import Header from "../components/Header";
import Scanner from "../screens/Scanner";
import Recharge from "../screens/RechargeScreen";
import AddCard from "../screens/AddCard";
import Registration from "../screens/Employee_Reg"
import Login from "../screens/Login";
import AdminPanel from "../screens/Admin";
import Transactions from "../screens/Transaction";
import UpdateEmployeeDetails from "../screens/updateEmp";
import ManageEmp from "../screens/ManageEmp";
import ManageGames from "../screens/ManageGames";
import AddGames from "../screens/addGame";
import UpdateGame from "../screens/updateGames";
import History from "../screens/history";

const RootNavigation = () => {
    return (
        <Router>
            <Header />
            <Routes>
                <Route path="/about" element={<AboutScreen />} />
                <Route path="/scan" element={<Scanner />} />
                <Route path="/recharge" element={<Recharge />}/>
                <Route path="/add" element={<AddCard />} />
                <Route path="/register" element={<Registration />} />
                <Route path="/" element={<Login />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/admin/reports" element={<Transactions />} />
                <Route path ="/admin/emps" element={<ManageEmp/>}/>
                <Route path="/admin/updateEmp" element={<UpdateEmployeeDetails />} />
                <Route path="/admin/games" element={<ManageGames/>} />
                <Route path="/admin/addgames" element={<AddGames/>} />
                <Route path="/admin/updategame" element={<UpdateGame/>} />
                <Route path="/admin/history" element={<History/>} />

                
            </Routes>
        </Router>
    );
};

export default RootNavigation;
