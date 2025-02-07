import axios from "axios";

async function ValidatePIN(upin, userID) {
    try {
        if (upin) {
        const body = {
            enteredPin: upin,
            userID: userID
        };
        console.log(body);
        const response = await axios.get("http://localhost:5000/api/auth/validatePin", body, {
            headers: {
                "Content-Type": "application/json",
            },

        }); if (response.data.status == 1001) {
            console.log("Pin OK");
            return true;
        } else {
            console.error("PIN failed");
            return false;
        }
        }
    } catch (error) {
        console.error("Error:", error.response?.data || error.message);
        return false;
    }
}

async function Logout(){
        // Remove token and other user details
        localStorage.removeItem("jwtToken");
        localStorage.removeItem("userID");
        localStorage.removeItem("user");

        // Redirect to the login page
        window.location.href = "/";
}
export {
    ValidatePIN,
    Logout,
}