import { jwtDecode } from "jwt-decode"; // Correct default import

const checkLoginCredentials = () => {
    const token = localStorage.getItem("jwtToken");
    
    if (!token) return handleLogout(); // No token, logout

    try {
        const { exp ,role} = jwtDecode(token);
        if (!exp || Date.now() >= exp * 1000) 
            {
                return handleLogout();
            }else{
                return role;
            }
    } catch (error) {
        console.error("JWT Decode Error:", error);
        return handleLogout(); // Invalid token
    }
};

const handleLogout = () => {
    localStorage.removeItem("jwtToken");
    if (window.location.pathname !== "/") {
        window.location.href = "/"; // Redirect only if not on login page
    }
};

export default {
    checkLoginCredentials,
    handleLogout
}
