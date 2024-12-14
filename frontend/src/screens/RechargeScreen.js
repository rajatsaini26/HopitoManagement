import React, { useState } from "react";

const Recharge = () =>{
    const [emp, setemp] = useState("John Doe");
    const [card, setCard] = useState("123:345:67:9");
    const [balance, setBalance] = useState('1000.0');
    const [method, setMethod] = useState("Online");

    return(
        <div className="form-container">
            <h2 className="form-title" style={{ textDecorationLine: 'underline' }}><i>Recharge GCM-Card</i></h2>
            <p style={{ textAlign: 'center', fontSize: 18, marginTop: -10, color: '#ff5722', textDecorationLine: 'underline' }}>( {emp} )</p>
            <form className="event-form">
                <div className="form-group">
                    <label>Card</label>
                    
                    <label style={{ color: "lightgreen",fontSize:20, textDecorationLine: 'underline' }}>{card}</label>
                </div>
                <div className="form-group">
                    <label>Balance</label>
                    <label style={{color:"lightgreen", fontSize:25, textDecoration:'underline'}}>{balance}</label>
                </div>
                <div className="form-group">
                    <label>
                        Recharge
                    </label>
                    <select className="form-input">
                        <option>500</option>
                        <option>1000</option>
                        <option>2000</option>
                        <option>4000</option>
                        <option>6000</option>
                    </select>
                </div>

                    <div className="form-group">
                        <label>
                            Payment Method
                        </label>
                        <select className="form-input">
                            <option>Cash</option>
                            <option>UPI</option>
                        </select>
                </div>
                <button type="submit" className="form-submit-button">Recharge</button>
            </form>
        </div>
    )
}
export default Recharge;