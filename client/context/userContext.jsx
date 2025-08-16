// userContext.jsx
import axios from "axios";
import { createContext, useEffect, useState } from "react";

export const UserContext = createContext({});

axios.defaults.baseURL = "http://localhost:8000";
axios.defaults.withCredentials = true;

export function UserContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("/api/auth/profile")
      .then(({ data }) => {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
          setUser({
            ...data,
            id: data.id ? parseInt(data.id, 10) : null, // Ensure integer ID
          });
        } else {
          // No logged-in user
          setUser(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Profile fetch error:", err.message);
        setUser(null);
        setLoading(false);
      });
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}
