import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import utils from "../components/Utils";

import "../css/admin.css"; // Assuming you want to style the cards
import Footer from "../components/Footer";
import Header from "../components/Header";

const AdminPanel = () => {
  const [user, setUser] = useState(); // Stores user info
  const navigate = useNavigate();

  useEffect(() => {
        // utils.checkLoginCredentials();
    
  }, []);

  const cards = [
    { title: "Transactions", link: "/admin/reports" },
    { title: "Individual Transaction", link: "/admin/history" },
    { title: "Manage Employee", link: "/admin/emps" },
    { title: "Manage Ports", link: "/manage-ports" },
    { title: "Manage Games", link: "/admin/games" },
    { title: "Check Card", link: "/scan" },
  ];

  return (
<div>
      <Header />
<div className="admin-panel">
      <h1>Welcome to Admin Panel </h1>
      <div className="card-container">
        {cards.map((card, index) => (
          <div className="card" key={index} onClick={() => navigate(card.link)}>
            <h2>{card.title}</h2>
          </div>
        ))}
      </div>
      <Footer />

    </div>
</div>

  );
};

export default AdminPanel;
