import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "./Header.css";
import logo from "../assests/logo.svg";
import { Link , useNavigate} from "react-router-dom";

const Header = () => {
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    // const [user, setUser] = useState();
    // const [userID, setuserID] = useState();
    let user = (localStorage.getItem('user'));
    let id = (localStorage.getItem('userID'));
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(()=>{
        // setUser(JSON.stringify);
        // setuserID(JSON.stringify));
    },[]);
    const ActiveScreen =  location.pathname ;

    const toggleDropdown = () => {
        setDropdownOpen((prevState)=>!prevState);
    };

    const JumpToScanner = () =>{
        navigate('/scan');
    }
    return (
        <div >
        {ActiveScreen!=="/" &&(
            <nav className="navbar">
                <img className="brandLogo" src={logo} onClick={JumpToScanner} alt="Company Logo" width="120" height="60" />
                <div className="nav-links">
                    {ActiveScreen!=="/scan" && (
                        <button className="user-btn" onClick={JumpToScanner}>
                            Scan Card
                        </button>
                    )}
                        
                        <button className="user-btn" onClick={toggleDropdown}>
                            {user}
                        </button>
                        
                    {isDropdownOpen && (
                        <div className={`dropdown ${isDropdownOpen ? 'open' : ''}`}>
                            <Link to="/profile" className="dropdown-item">Profile</Link>
                            <a href="/logout" className="dropdown-item">Logout</a>
                        </div>
                    )}
                </div>

            </nav>
        )}
        </div>
    );
};

export default Header;
