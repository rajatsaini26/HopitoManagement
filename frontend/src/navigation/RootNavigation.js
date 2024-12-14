import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AboutScreen from "../screens/AboutScreen";
import Header from "../components/Header";
import Scanner from "../screens/Scanner";
import Recharge from "../screens/RechargeScreen";
import AddCard from "../screens/AddCard";
import Registration from "../screens/Employee_Reg"
import Login from "../screens/Login";

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

            </Routes>
        </Router>
    );
};

export default RootNavigation;
