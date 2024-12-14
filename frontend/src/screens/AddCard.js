import React, { useState } from "react";
import "../css/addcard.css"
const AddCard = () => {
    const [emp, setemp] = useState("John Doe");
    const [card, setCard] = useState("123:345:67:9");
    return (
        <div className="form-container">
            <h2 className="form-title">Add GCM-Card</h2>
            <p style={{ textAlign: 'center', fontSize: 18, marginTop: -10, color:'#ff5722',textDecorationLine:'underline'}}>( {emp} )</p>
            <form className="event-form">
                <div className="form-group">
                    <label>
                        Name
                    </label>
                    <div className="name-fields">
                        <input type="text" placeholder="First Name" className="form-input" />
                        <input type="text" placeholder="Last Name" className="form-input" />
                    </div>
                </div>
                <div className="form-group">
                    <label>Email</label>
                    <input type="email" placeholder="example@email.com" className="form-input" />
                </div>
                <div className="form-group">
                    <label>Phone</label>
                    <div className="phone-fields">
                        <input type="text" placeholder="Phone Number" className="form-input" />
                    </div>
                </div>
                <div className="form-group">
                    <label>
                        Card-Level
                    </label>
                    <select className="form-input">
                        <option>1000</option>
                        <option>3000</option>
                        <option>5000</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Card</label>
                    <label style={{ color:"#478CCF",fontSize:20, textDecorationLine:'underline'}}>{card}</label>
                </div>
                <button type="submit" className="form-submit-button">Add Card</button>
            </form>
        </div>
    );
};

export default AddCard;
