import { useContext } from "react";
import { UserContext } from "../../../context/userContext";
import PageLayout from "../../components/layout/PageLayout";
import { Link } from "react-router-dom";
import { Package, ClipboardList, RefreshCw, Box } from "lucide-react";

export default function DashboardStaff() {
	const { user } = useContext(UserContext);

	const modules = [
		{ label: "Borrow Requests",    icon: <ClipboardList className="w-6 h-6" />, to: "/staff/manage-requests",    priority: true },
		{ label: "Manage Returns",     icon: <RefreshCw   className="w-6 h-6" />, to: "/staff/return-items",       priority: false },
		{ label: "Available Items",    icon: <Package     className="w-6 h-6" />, to: "/staff/available-items",   priority: false },
		{ label: "Inventory",          icon: <Box         className="w-6 h-6" />, to: "/staff/manage-inventory",   priority: false },
	];

	return (
		<PageLayout>
			{/* Welcome Section */}
			<section className="mb-12">
				<div>
					<h1 className="font-headline text-5xl md:text-6xl text-on-surface leading-tight">
						Welcome back, {user?.name || "Staff"}
					</h1>
					<p className="text-on-surface-variant mt-4 text-base max-w-2xl">
						Here's what you can manage today.
					</p>
				</div>
			</section>

			{/* Workspace Label */}
			<section className="mb-8">
				<span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Your Workspace</span>
			</section>

			{/* Module Grid - Secondary Actions */}
			<section>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{modules.map((mod) => (
						<Link 
							to={mod.to} 
							key={mod.label} 
							className={`group cursor-pointer transition-all duration-200 ${
								mod.priority ? "md:col-span-1" : ""
							}`}
						>
							<div className={`p-6 rounded-xl shadow-sm border transition-all h-full flex flex-col items-center justify-center text-center gap-3 hover:scale-[1.03] hover:-translate-y-1 ${
								mod.priority
									? "bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20"
									: "bg-surface-container-lowest border-outline-variant/10 hover:border-primary/30 hover:shadow-md"
							}`}>
								<div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all group-hover:scale-110 ${
									mod.priority
										? "bg-primary/20 text-primary group-hover:bg-primary group-hover:text-on-primary"
										: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary"
								}`}>
									{mod.icon}
								</div>
								<h4 className={`font-bold text-sm transition-colors ${
									mod.priority
										? "text-primary"
										: "text-on-surface group-hover:text-primary"
								}`}>
									{mod.label}
								</h4>
							</div>
						</Link>
					))}
				</div>
			</section>
		</PageLayout>
	);
}