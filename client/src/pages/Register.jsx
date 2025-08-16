import { useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  const registerUser = async (e) => {
    e.preventDefault();
    const { name, email, password, phone } = data;

    try {
      const res = await axios.post('/api/auth/register', {
        name,
        email,
        password,
        phone,
      });

      if (res.data.error) {
        toast.error(res.data.error);
      } else {
        toast.success("Registration Successful. Welcome!");
        navigate("/login");
      }
    } catch (error) {
      console.log(error);
      toast.error("Something went wrong.");
    }
  };

  return (
    <div>
      <form onSubmit={registerUser}>
        <label>Name</label>
        <input
          type="text"
          placeholder="Enter name..."
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          required
        />

        <label>Email</label>
        <input
          type="email"
          placeholder="Enter email..."
          value={data.email}
          onChange={(e) => setData({ ...data, email: e.target.value })}
          required
        />

        <label>Password</label>
        <input
          type="password"
          placeholder="Enter password..."
          value={data.password}
          onChange={(e) => setData({ ...data, password: e.target.value })}
          required
        />

        <label>Phone Number</label>
        <input
          type="text"
          placeholder="Enter phone number..."
          value={data.phone}
          onChange={(e) => setData({ ...data, phone: e.target.value })}
          required
        />

        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
