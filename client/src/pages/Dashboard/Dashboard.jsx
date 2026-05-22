import React, { useContext, useEffect } from "react";
import { UserContext } from "../../../context/userContext";
import { useNavigate } from "react-router-dom";
import DashboardBorrower from "./DashboardBorrower";
import DashboardStaff from "./DashboardStaff";
import DashboardAdmin from "./DashboardAdmin";

export default function Dashboard() {
	const { user, loading } = useContext(UserContext);
	const navigate = useNavigate();

	useEffect(() => {
		if (!loading && user === null) {
			navigate("/login");
		}
	}, [user, loading, navigate]);

	if (loading) return <div className="text-center mt-10">Loading...</div>;
	if (!user) return null;

	// ✅ Show borrower dashboard only, without extra spacing or greeting
	if (user.role === "borrower") {
		return <DashboardBorrower />;
	}

	// ✅ Staff and Admin dashboards retain container styling
	return (
		<div className="">
			{user.role === "staff" && <DashboardStaff />}
			{user.role === "admin" && <DashboardAdmin />}
		</div>
	);
}