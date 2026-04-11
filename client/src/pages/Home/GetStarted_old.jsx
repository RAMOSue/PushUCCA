import { useNavigate, Link } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "../../../context/userContext";
import { LoginModalContext } from "../../../context/LoginModalContext";
import { motion } from "framer-motion";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Eye, EyeOff, AlertCircle, ChevronLeft, ChevronRight, Menu, X as XIcon } from "lucide-react";

// Material Symbols Icon Component
const MaterialIcon = ({ icon, className = "" }) => (
	<span className={`material-symbols-outlined ${className}`} data-icon={icon}>{icon}</span>
);

// ============================================
// ANIMATION VARIANTS
// ============================================
const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1, delayChildren: 0.2 }
	}
};

const itemVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const slideInVariants = {
	hidden: { opacity: 0, x: -50 },
	visible: { opacity: 1, x: 0, transition: { duration: 0.8 } }
};

// ============================================
// REUSABLE SECTION WRAPPER
// ============================================
const Section = ({ children, className = "" }) => (
	<motion.section
		initial={{ opacity: 0 }}
		whileInView={{ opacity: 1 }}
		transition={{ duration: 0.8 }}
		viewport={{ once: true, amount: 0.2 }}
		className={className}
	>
		{children}
	</motion.section>
);

export default function GetStarted() {
	const { user, loading, setUser } = useContext(UserContext);
	const {
		showLoginModal,
		setShowLoginModal,
		closeLoginModal,
		showRegisterModal,
		setShowRegisterModal,
		closeRegisterModal,
		switchToRegister,
		switchToLogin,
	} = useContext(LoginModalContext);
	const navigate = useNavigate();

	// ✅ Local component states
	const [showPassword, setShowPassword] = useState(false);
	const [loginData, setLoginData] = useState({ email: "", password: "" });
	const [registerData, setRegisterData] = useState({ name: "", email: "", password: "", phone: "" });
	const [isLoading, setIsLoading] = useState(false);
	const [loginErrors, setLoginErrors] = useState({});
	const [registerErrors, setRegisterErrors] = useState({});
	const [loginAttempts, setLoginAttempts] = useState(0);
	const [isLoginLocked, setIsLoginLocked] = useState(false);
	
	// ✅ SLIDESHOW: Image carousel state
	const [slideImages, setSlideImages] = useState([]);
	const [currentSlide, setCurrentSlide] = useState(0);
	const [slideshowLoading, setSlideshowLoading] = useState(true);
	const [showDropdown, setShowDropdown] = useState(false);
	
	// ✅ SEARCH & FILTERS
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedFilters, setSelectedFilters] = useState({
		culture: "all",
		type: "all",
		event: "all"
	});

	// ✅ CULTURAL DATA
	const culturalNarratives = [
		{
			id: 1,
			title: "The Sound of Tradition",
			tagline: "Where Heritage Comes to Life",
			subtitle: "Explore. Learn. Experience. Preserve Culture.",
			imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=400&fit=crop",
		},
		{
			id: 2,
			title: "Stories Woven in Costumes",
			tagline: "Where Heritage Comes to Life",
			subtitle: "Explore. Learn. Experience. Preserve Culture.",
			imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=400&fit=crop",
		},
		{
			id: 3,
			title: "Celebrations of Heritage",
			tagline: "Where Heritage Comes to Life",
			subtitle: "Explore. Learn. Experience. Preserve Culture.",
			imageUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&h=400&fit=crop",
		},
	];

	const exploreCultureCards = [
		{
			icon: "masks",
			title: "Costumes by Culture",
			description: "Discover traditional attire from different cultures and regions",
			color: "from-purple-500 to-pink-500"
		},
		{
			icon: "library_music",
			title: "Instruments by Region",
			description: "Explore musical heritage and traditional instruments",
			color: "from-blue-500 to-cyan-500"
		},
		{
			icon: "public",
			title: "Explore Traditions",
			description: "Learn stories behind cultural practices and rituals",
			color: "from-green-500 to-emerald-500"
		},
		{
			icon: "celebrate",
			title: "Cultural Events",
			description: "Join celebrations and experience living heritage",
			color: "from-yellow-500 to-orange-500"
		}
	];

	const testimonials = [
		{
			text: "Using the kulintang made our performance authentic and meaningful.",
			author: "Maria Santos",
			role: "Cultural Performer"
		},
		{
			text: "Learning about the instruments helped us understand our heritage deeper.",
			author: "Juan Dela Cruz",
			role: "Student"
		},
		{
			text: "The costumes brought our cultural celebration to life.",
			author: "Rosa Garcia",
			role: "Event Organizer"
		}
	];

	const howItWorks = [
		{
			step: 1,
			icon: "explore",
			title: "Explore Culture",
			description: "Discover cultural artifacts and their stories"
		},
		{
			step: 2,
			icon: "auto_stories",
			title: "Learn the Story",
			description: "Understand the heritage and traditions behind each item"
		},
		{
			step: 3,
			icon: "card_giftcard",
			title: "Borrow & Experience",
			description: "Use authentic items in your cultural events"
		}
	];

	// ✅ SLIDESHOW: Fetch images from Master List API
	useEffect(() => {
		const fetchSlideImages = async () => {
			try {
				setSlideshowLoading(true);
				const res = await axios.get("http://localhost:8000/api/master-list/slideshow-images");
				const images = Array.isArray(res.data) ? res.data : [];
				setSlideImages(images.length > 0 ? images : culturalNarratives);
			} catch (err) {
				console.error("Failed to fetch slideshow images:", err);
				setSlideImages(culturalNarratives);
			} finally {
				setSlideshowLoading(false);
			}
		};
		fetchSlideImages();
	}, []);

	// ✅ SLIDESHOW: Auto-transition effect
	useEffect(() => {
		if (slideImages.length === 0) return;
		const interval = setInterval(() => {
			setCurrentSlide((prev) => (prev + 1) % slideImages.length);
		}, 8000);
		return () => clearInterval(interval);
	}, [slideImages]);

	// ✅ SLIDESHOW: Navigation handlers
	const goToSlide = (index) => {
		setCurrentSlide(index % slideImages.length);
	};

	const nextSlide = () => {
		goToSlide(currentSlide + 1);
	};

	const prevSlide = () => {
		goToSlide(currentSlide - 1 >= 0 ? currentSlide - 1 : slideImages.length - 1);
	};

	// ✅ SECURITY: Rate limiting for login
	useEffect(() => {
		if (loginAttempts >= 5) {
			setIsLoginLocked(true);
			const timer = setTimeout(() => {
				setLoginAttempts(0);
				setIsLoginLocked(false);
				toast.success("🔓 Account unlocked. Try again.");
			}, 15 * 60 * 1000);
			return () => clearTimeout(timer);
		}
	}, [loginAttempts]);

	// ✅ SECURITY: Validate login form
	const validateLoginForm = () => {
		const errors = {};
		if (!loginData.email) {
			errors.email = "Email is required";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email)) {
			errors.email = "Invalid email format";
		}
		if (!loginData.password) {
			errors.password = "Password is required";
		} else if (loginData.password.length < 6) {
			errors.password = "Password must be at least 6 characters";
		}
		setLoginErrors(errors);
		return Object.keys(errors).length === 0;
	};

	// ✅ SECURITY: Validate register form
	const validateRegisterForm = () => {
		const errors = {};
		if (!registerData.name) {
			errors.name = "Name is required";
		}
		if (!registerData.email) {
			errors.email = "Email is required";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerData.email)) {
			errors.email = "Invalid email format";
		}
		if (!registerData.phone) {
			errors.phone = "Phone is required";
		}
		if (!registerData.password) {
			errors.password = "Password is required";
		} else if (registerData.password.length < 6) {
			errors.password = "Password must be at least 6 characters";
		}
		setRegisterErrors(errors);
		return Object.keys(errors).length === 0;
	};

	// ✅ SECURITY: Redirect logged-in users away from public page
	useEffect(() => {
		if (!loading && user) {
			// Redirect based on role to appropriate dashboard
			const role = user?.role;
			if (role === "admin") {
				navigate("/admin/available-items", { replace: true });
			} else if (role === "staff") {
				navigate("/staff/available-items", { replace: true });
			} else {
				navigate("/available-items", { replace: true });
			}
		}
	}, [user, loading, navigate]);

	// Login handler
	const handleLogin = async (e) => {
		e.preventDefault();
		
		if (isLoginLocked) {
			toast.error("🔐 Too many login attempts. Please try again after 15 minutes.");
			return;
		}

		if (!validateLoginForm()) {
			return;
		}

		setIsLoading(true);
		try {
			const res = await axios.post(
				"http://localhost:8000/api/auth/login",
				{ email: loginData.email.toLowerCase().trim(), password: loginData.password },
				{ withCredentials: true }
			);

			if (res.data.error) {
				setLoginAttempts(prev => prev + 1);
				toast.error(res.data.error);
			} else {
				setLoginAttempts(0);
				toast.success("✅ Login successful!");
				const loggedInUser = res.data.user;
				setUser(loggedInUser);
				setLoginData({ email: "", password: "" });
				setLoginErrors({});
				
				// Redirect based on user role
				const role = loggedInUser.role;
				if (role === "admin") {
					navigate("/admin/available-items");
				} else if (role === "staff") {
					navigate("/staff/available-items");
				} else {
					navigate("/available-items");
				}
			}
		} catch (error) {
			setLoginAttempts(prev => prev + 1);
			const errorMsg = error.response?.data?.error || "Login failed. Please try again.";
			toast.error(errorMsg);
			if (loginAttempts >= 2) {
				toast.error(`⚠️ ${5 - loginAttempts - 1} attempts remaining before lock`);
			}
		} finally {
			setIsLoading(false);
		}
	};

	// Register handler
	const handleRegister = async (e) => {
		e.preventDefault();
		setIsLoading(true);
		try {
			const res = await axios.post("http://localhost:8000/api/auth/register", {
				name: registerData.name,
				email: registerData.email.toLowerCase().trim(),
				password: registerData.password,
				phone: registerData.phone,
			});

			if (res.data.error) {
				toast.error(res.data.error);
			} else {
				toast.success("✅ Check your email for verification code!");
				setRegisterData({ name: "", email: "", password: "", phone: "" });
				closeRegisterModal();
				navigate("/verify-email", { state: { email: registerData.email } });
			}
		} catch (error) {
			const errorMsg = error.response?.data?.error || "Registration failed. Please try again.";
			toast.error(errorMsg);
		} finally {
			setIsLoading(false);
		}
	};

	// Show loading state
	if (loading) {
		return (
			<div className="min-h-screen bg-[#003300] flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#92D6A2] mx-auto mb-4"></div>
					<p className="text-[#C8EDBA] text-lg">Loading...</p>
				</div>
			</div>
		);
	}

	// Don't render if user is logged in (redirect should happen above)
	if (user) {
		return null;
	}

	return (
		<div className="min-h-screen bg-[#003300] relative overflow-hidden">
			{/* ✅ NAVIGATION BAR */}
			<nav className="bg-white shadow-lg z-40">
				<div className="max-w-7xl mx-auto px-6 py-10 flex items-center justify-between">
					{/* Logo */}
					<div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
						<MaterialIcon icon="music_note" className="text-[#003300] text-2xl" />
						<span className="font-headline font-bold text-[#003300] text-lg">CSU INSTRUMENTS</span>
					</div>

					{/* Spacer */}
					<div className="flex-1" />

					{/* About Us Dropdown */}
					<div className="relative">
						<button
							onClick={() => setShowDropdown(!showDropdown)}
							className="px-6 py-2 text-[#003300] font-semibold hover:text-[#92D6A2] transition-colors flex items-center gap-2"
						>
							About Us
							<MaterialIcon icon={showDropdown ? "expand_less" : "expand_more"} className="text-lg" />
						</button>
						{showDropdown && (
							<motion.div
								initial={{ opacity: 0, y: -10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								className="absolute right-0 mt-2 w-48 bg-white shadow-xl rounded-lg overflow-hidden"
							>
								<button className="block w-full text-left px-4 py-3 text-[#003300] hover:bg-[#003300]/5 transition">About Our Center</button>
								<button className="block w-full text-left px-4 py-3 text-[#003300] hover:bg-[#003300]/5 transition">Our Mission</button>
								<button className="block w-full text-left px-4 py-3 text-[#003300] hover:bg-[#003300]/5 transition">Contact Us</button>
							</motion.div>
						)}
					</div>
				</div>
			</nav>

			{/* ✅ IMAGE SLIDESHOW - Infinite Carousel */}
			{slideImages.length > 0 ? (
			<div className="relative w-full h-[620px] overflow-hidden">
				{/* Slides Container - Shows 3 slides in a row, translateX creates continuous scrolling */}
				<motion.div
					className="flex h-full"
					animate={{ x: "-100%" }}
					initial={{ x: 0 }}
					transition={{ duration: 0.8, ease: "easeInOut" }}
					key={`slide-${currentSlide}`}
				>
					{/* Previous Slide */}
					<div className="w-full h-full flex-shrink-0 overflow-hidden">
						<img
							src={slideImages[(currentSlide - 1 + slideImages.length) % slideImages.length]?.imageUrl}
							alt="Previous"
							className="w-full h-full object-cover"
						/>
					</div>

					{/* Current Slide */}
					<div className="w-full h-full flex-shrink-0 overflow-hidden">
						<img
							src={slideImages[currentSlide]?.imageUrl}
							alt="Current"
							className="w-full h-full object-cover"
						/>
					</div>

					{/* Next Slide */}
					<div className="w-full h-full flex-shrink-0 overflow-hidden">
						<img
							src={slideImages[(currentSlide + 1) % slideImages.length]?.imageUrl}
							alt="Next"
							className="w-full h-full object-cover"
						/>
					</div>
				</motion.div>

				{/* Previous Button */}
				<motion.button
					whileHover={{ scale: 1.1 }}
					whileTap={{ scale: 0.95 }}
					onClick={prevSlide}
					className="absolute left-6 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-3 rounded-full transition-all z-10"
				>
					<ChevronLeft className="w-6 h-6" />
				</motion.button>

				{/* Next Button */}
				<motion.button
					whileHover={{ scale: 1.1 }}
					whileTap={{ scale: 0.95 }}
					onClick={nextSlide}
					className="absolute right-6 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-3 rounded-full transition-all z-10"
				>
					<ChevronRight className="w-6 h-6" />
				</motion.button>

				{/* Slide Indicators */}
				<div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-3 z-10">
					{slideImages.map((_, index) => (
						<motion.button
							key={index}
							onClick={() => goToSlide(index)}
							whileHover={{ scale: 1.2 }}
							className={`w-3 h-3 rounded-full transition-all ${
								index === currentSlide ? "bg-white w-8" : "bg-white/50"
							}`}
						/>
					))}
				</div>
			</div>
			) : (
				<div className="relative w-full h-[620px] bg-gradient-to-b from-[#013300] to-[#003300] flex items-center justify-center">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#92D6A2] mx-auto mb-4"></div>
						<p className="text-[#C8EDBA]/60">Loading slideshow...</p>
					</div>
				</div>
			)}

			{/* Main Content */}
			<main className="relative z-0 bg-white">
				{/* Hero Header */}
				<header className="py-12 px-6 text-center max-w-5xl mx-auto space-y-4">
					<h2 className="text-4xl md:text-6xl font-headline text-[#003300] tracking-tight font-medium uppercase">
						Preserve the Past. Experience the Culture.
					</h2>
				</header>

				{/* EXPLORE Section */}
				<section className="px-6 mb-12 max-w-4xl mx-auto">
					<div className="text-center mb-4">
						<h3 className="text-sm font-black tracking-[0.2em] text-stone-800 uppercase">EXPLORE</h3>
					</div>
					<div className="relative group">
						<div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
							<MaterialIcon icon="search" className="text-stone-400 group-focus-within:text-[#004d1a] transition-colors text-xl" />
						</div>
						<input 
							className="w-full h-16 pl-14 pr-6 rounded-lg border-2 border-stone-200 focus:border-[#004d1a] focus:ring-0 text-lg font-body transition-all bg-white placeholder-stone-400"
							placeholder="Search instruments..."
							type="text"
						/>
					</div>
				</section>

				{/* QUICK LINKS Section */}
				<section className="px-6 mb-16 max-w-6xl mx-auto">
					<div className="text-center mb-6">
						<h3 className="text-sm font-black tracking-[0.2em] text-stone-800 uppercase">QUICK LINKS:</h3>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
						<button className="bg-[#003d15] hover:bg-black text-white py-4 px-6 rounded-lg flex items-center justify-between transition-colors group">
							<span className="text-xs font-black tracking-wider uppercase">Available Items</span>
							<MaterialIcon icon="music_note" className="text-lg" />
						</button>
						<button className="bg-[#003d15] hover:bg-black text-white py-4 px-6 rounded-lg flex items-center justify-between transition-colors group">
							<span className="text-xs font-black tracking-wider uppercase">My Borrowings</span>
							<MaterialIcon icon="shopping_bag" className="text-lg" />
						</button>
						<button className="bg-[#003d15] hover:bg-black text-white py-4 px-6 rounded-lg flex items-center justify-between transition-colors group">
							<span className="text-xs font-black tracking-wider uppercase">Your Requests</span>
							<MaterialIcon icon="assignment" className="text-lg" />
						</button>
						<button className="bg-[#003d15] hover:bg-black text-white py-4 px-6 rounded-lg flex items-center justify-between transition-colors group">
							<span className="text-xs font-black tracking-wider uppercase">Contact Us</span>
							<MaterialIcon icon="mail" className="text-lg" />
						</button>
					</div>
				</section>

				{/* MY SERVICES Section */}
				<section className="px-6 mb-16 max-w-7xl mx-auto">
					<div className="text-center mb-8">
						<h3 className="text-sm font-black tracking-[0.2em] text-stone-800 uppercase">MY SERVICES</h3>
					</div>
					<div className="flex overflow-x-auto gap-4 pb-6 no-scrollbar snap-x">
						{/* Service Card 1 */}
						<div className="min-w-[280px] aspect-[4/3] rounded-xl overflow-hidden relative group cursor-pointer snap-start flex-shrink-0">
							<img 
								alt="Musical Instruments" 
								className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
								src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=450&fit=crop"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
							<div className="absolute bottom-0 left-0 right-0 p-4 bg-[#004d1a]/90 backdrop-blur-sm">
								<p className="text-white font-bold text-center uppercase tracking-widest text-sm">Instruments</p>
							</div>
						</div>

						{/* Service Card 2 */}
						<div className="min-w-[280px] aspect-[4/3] rounded-xl overflow-hidden relative group cursor-pointer snap-start flex-shrink-0">
							<img 
								alt="Costumes" 
								className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
								src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=450&fit=crop"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
							<div className="absolute bottom-0 left-0 right-0 p-4 bg-[#004d1a]/90 backdrop-blur-sm">
								<p className="text-white font-bold text-center uppercase tracking-widest text-sm">Costumes</p>
							</div>
						</div>

						{/* Service Card 3 */}
						<div className="min-w-[280px] aspect-[4/3] rounded-xl overflow-hidden relative group cursor-pointer snap-start flex-shrink-0">
							<div className="w-full h-full bg-stone-100 flex items-center justify-center">
								<MaterialIcon icon="event_note" className="text-6xl text-stone-300" />
							</div>
							<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
							<div className="absolute bottom-0 left-0 right-0 p-4 bg-[#004d1a]/90 backdrop-blur-sm">
								<p className="text-white font-bold text-center uppercase tracking-widest text-sm">Events</p>
							</div>
						</div>

						{/* Service Card 4 */}
						<div className="min-w-[280px] aspect-[4/3] rounded-xl overflow-hidden relative group cursor-pointer snap-start flex-shrink-0">
							<div className="w-full h-full bg-stone-100 flex items-center justify-center">
								<MaterialIcon icon="info" className="text-6xl text-stone-300" />
							</div>
							<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
							<div className="absolute bottom-0 left-0 right-0 p-4 bg-[#004d1a]/90 backdrop-blur-sm">
								<p className="text-white font-bold text-center uppercase tracking-widest text-sm">More Info</p>
							</div>
						</div>
					</div>
				</section>

				{/* CTA Buttons - Moved to bottom */}
				<section className="px-6 pb-20 max-w-7xl mx-auto">
					<div className="text-center mb-12">
						<h3 className="text-sm font-black tracking-[0.2em] text-stone-800 uppercase mb-6">Get Started</h3>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<button
								onClick={() => setShowLoginModal(true)}
								className="px-8 py-4 bg-[#004d1a] hover:bg-[#003d15] text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-center text-sm font-headline uppercase tracking-tight"
							>
								Sign In
							</button>
							<button
								onClick={() => setShowRegisterModal(true)}
								className="px-8 py-4 bg-white hover:bg-stone-50 text-[#004d1a] font-bold border-2 border-[#004d1a] rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-center text-sm font-headline uppercase tracking-tight"
							>
								Create Account
							</button>
						</div>
					</div>

					{/* Inventory Management Card */}
					<div className="relative group overflow-hidden bg-white rounded-xl border border-stone-200 p-8 max-w-lg mx-auto">
						<div className="relative z-10 space-y-4">
							<MaterialIcon icon="inventory_2" className="text-[#004d1a] text-4xl" />
							<h2 className="text-2xl font-bold font-headline text-stone-900">Inventory Management</h2>
							<p className="text-stone-600 text-sm leading-relaxed">
								Comprehensive tracking and curation of the university's musical instruments, costumes, and artistic collections with real-time updates.
							</p>
							<button className="mt-4 flex items-center gap-2 text-[#004d1a] font-bold text-sm uppercase tracking-wider group-hover:gap-3 transition-all">
								Learn More <MaterialIcon icon="arrow_forward" className="text-sm" />
							</button>
						</div>
					</div>
				</section>
			</main>

			{/* Footer */}
		<footer className="w-full border-t border-stone-100 bg-white">
			<div className="w-full px-6 sm:px-12 py-16 flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto">
				<div className="mb-8 md:mb-0">
					<div className="text-[#004d1a] font-bold text-lg font-headline mb-2">Golden Padlers</div>
					<div className="font-body text-[10px] uppercase tracking-[0.2em] text-stone-500">
						© 2025 Caraga State University. All rights reserved.
					</div>
				</div>
				<div className="flex gap-8 font-body text-[10px] uppercase tracking-[0.2em]">
					<a className="text-stone-400 hover:text-[#004d1a] transition-all" href="#">Privacy</a>
					<a className="text-stone-400 hover:text-[#004d1a] transition-all" href="#">Terms</a>
					<a className="text-stone-400 hover:text-[#004d1a] transition-all" href="#">Accessibility</a>
				</div>
			</div>
		</footer>

			{/* Login Modal Backdrop */}
			{showLoginModal && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.3 }}
					className="fixed inset-0 bg-black/40 z-40 top-0"
					onClick={() => closeLoginModal()}
				/>
			)}

			{/* Login Modal */}
			<motion.div
				initial={{ x: "100%" }}
				animate={{ x: showLoginModal ? 0 : "100%" }}
				transition={{ duration: 0.4, ease: "easeInOut" }}
				className="fixed right-0 top-[69px] h-[calc(100vh-50px)] w-full md:w-1/2 bg-black z-50 overflow-hidden"
				style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)' }}
				onClick={(e) => e.stopPropagation()}
			>
				<button
					onClick={() => closeLoginModal()}
					className="absolute top-6 right-6 text-gray-600 hover:text-gray-900 transition z-10"
				>
					<MaterialIcon icon="close" className="text-2xl" />
				</button>

				{/* Inner content with reveal effect */}
				<motion.div
					initial={{ x: "-100%" }}
					animate={{ x: showLoginModal ? 0 : "-100%" }}
					transition={{ duration: 0.4, ease: "easeInOut" }}
					className="h-full w-full overflow-y-auto p-8 md:p-12"
				>
				<div className="max-w-md ml-[180px]">
					{/* Form Card */}
					<div className="bg-white rounded-2xl p-8 border border-gray-200">
						{/* Heading */}
						<div className="text-center mb-8">
							<h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome Back</h1>
							<p className="text-yellow-600 text-sm font-semibold uppercase tracking-wider">Caraga State University</p>
							<p className="text-gray-600 text-xs mt-2">Musical Instruments & Costumes Management System</p>
						</div>

						{/* Security Alert - Rate Limiting */}
						{isLoginLocked && (
							<motion.div
								initial={{ opacity: 0, y: -10 }}
								animate={{ opacity: 1, y: 0 }}
								className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3 mb-6"
							>
								<AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
								<div>
									<p className="text-red-900 font-semibold text-sm">🔐 Account Temporarily Locked</p>
									<p className="text-red-700 text-xs mt-1">Too many failed attempts. Please try again after 15 minutes.</p>
								</div>
							</motion.div>
						)}

						{/* Form */}
						<form onSubmit={handleLogin} className="space-y-5">
							{/* Email Field */}
							<div>
							<label className="block text-gray-700 font-semibold text-sm mb-2">Email Address</label>
							<input
								type="email"
								className={`w-full px-4 py-3 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
									loginErrors.email ? "border-red-500 focus:ring-red-400" : "border-gray-300 focus:ring-yellow-400 focus:border-transparent"
								}`}
								placeholder="Enter your email..."
								value={loginData.email}
								onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
								disabled={isLoginLocked || isLoading}
								required
							/>
							{loginErrors.email && <p className="text-red-600 text-xs mt-1">⚠️ {loginErrors.email}</p>}
							</div>

							{/* Password Field */}
							<div>
							<label className="block text-gray-700 font-semibold text-sm mb-2">Password</label>
							<div className="relative">
								<input
									type={showPassword ? "text" : "password"}
									className={`w-full px-4 py-3 pr-12 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
										loginErrors.password ? "border-red-500 focus:ring-red-400" : "border-gray-300 focus:ring-yellow-400 focus:border-transparent"
									}`}
									placeholder="Enter your password..."
									value={loginData.password}
									onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
									disabled={isLoginLocked || isLoading}
									required
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									disabled={isLoginLocked || isLoading}
									className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition disabled:opacity-50"
								>
									{showPassword ? (
										<EyeOff className="w-5 h-5" />
									) : (
										<Eye className="w-5 h-5" />
									)}
								</button>
							</div>
							{loginErrors.password && <p className="text-red-600 text-xs mt-1">⚠️ {loginErrors.password}</p>}
							</div>

							{/* Remember & Forgot */}
							<div className="flex items-center justify-between text-xs">
								<label className="flex items-center gap-2 text-gray-600 cursor-pointer">
									<input type="checkbox" className="rounded" />
									<span>Remember me</span>
								</label>
								<a href="#" className="text-yellow-600 hover:text-yellow-700 transition">
									Forgot password?
								</a>
							</div>

							{/* Login Button */}
							<button
								type="submit"
								disabled={isLoading || isLoginLocked || loginErrors.email || loginErrors.password || !loginData.email || !loginData.password}
								className={`w-full mt-6 px-6 py-3 font-bold rounded-lg shadow-xl transition-all duration-300 transform text-sm ${
									isLoginLocked
										? "bg-gray-500 cursor-not-allowed opacity-50 text-gray-300"
										: isLoading
										? "bg-yellow-500 text-gray-900 scale-105"
										: "bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 hover:shadow-2xl hover:scale-105"
								}`}
							>
								{isLoading ? (
									<span className="flex items-center justify-center gap-2">
										<div className="animate-spin h-5 w-5 border-b-2 border-gray-900"></div>
										Logging in...
									</span>
								) : isLoginLocked ? (
									"🔐 Account Locked (15 min)"
								) : (
									"Log In"
								)}
							</button>

							{/* Divider */}
							<div className="flex items-center gap-4 my-6">
								<div className="flex-1 h-px bg-gray-300"></div>
								<span className="text-gray-500 text-xs">OR</span>
								<div className="flex-1 h-px bg-gray-300"></div>
							</div>

							{/* Google Login */}
							<a
								href="http://localhost:8000/api/auth/google"
								className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
							>
							<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
								<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
								<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
								<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
								<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
							</svg>
								Sign in with Google
							</a>
						</form>

						{/* Signup Link */}
						<p className="text-center text-gray-600 text-sm mt-6">
							Don't have an account?{" "}
							<button
								type="button"
								onClick={switchToRegister}
								className="text-yellow-600 font-semibold hover:text-yellow-700 transition"
							>
								Create one here
							</button>
						</p>
					</div>

					{/* Security Info */}
					<motion.p
						className="text-center text-gray-500 text-xs mt-6"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.4 }}
					>
						🔒 Secure authentication • University verified
					</motion.p>
				</div>
				</motion.div>
			</motion.div>

			{/* Register Modal Backdrop */}
			{showRegisterModal && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.3 }}
					className="fixed inset-0 bg-black/40 z-40 top-0"
					onClick={() => closeRegisterModal()}
				/>
			)}

			{/* Register Modal */}
			<motion.div
				initial={{ x: "100%" }}
				animate={{ x: showRegisterModal ? 0 : "100%" }}
				transition={{ duration: 0.4, ease: "easeInOut" }}
				className="fixed right-0 top-[69px] h-[calc(100vh-50px)] w-full md:w-1/2 bg-white z-50 overflow-hidden"
				style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)' }}
				onClick={(e) => e.stopPropagation()}
			>
				<button
					onClick={() => closeRegisterModal()}
					className="absolute top-6 right-6 text-gray-600 hover:text-gray-900 transition z-10"
				>
					<MaterialIcon icon="close" className="text-2xl" />
				</button>

				{/* Inner content with reveal effect */}
				<motion.div
					initial={{ x: "-100%" }}
					animate={{ x: showRegisterModal ? 0 : "-100%" }}
					transition={{ duration: 0.4, ease: "easeInOut" }}
					className="h-full w-full overflow-y-auto p-8 md:p-12"
				>
				<div className="max-w-md ml-[180px]">
					{/* Form Card */}
					<div className="bg-white rounded-2xl p-8 border border-gray-200">
						{/* Heading */}
						<div className="text-center mb-8">
							<h1 className="text-4xl font-bold text-gray-900 mb-2">Create Account</h1>
							<p className="text-yellow-600 text-sm font-semibold uppercase tracking-wider">Caraga State University</p>
							<p className="text-gray-600 text-xs mt-2">Join our community</p>
						</div>

						{/* Form */}
						<form onSubmit={handleRegister} className="space-y-5">
							{/* Full Name Field */}
							<div>
							<label className="block text-gray-700 font-semibold text-sm mb-2">Full Name</label>
							<input
								type="text"
								className={`w-full px-4 py-3 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
									registerErrors.name ? "border-red-500 focus:ring-red-400" : "border-gray-300 focus:ring-yellow-400 focus:border-transparent"
								}`}
								placeholder="Enter your full name..."
								value={registerData.name}
								onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
								disabled={isLoading}
								required
							/>
							{registerErrors.name && <p className="text-red-600 text-xs mt-1">⚠️ {registerErrors.name}</p>}
							</div>

							{/* Email Field */}
							<div>
							<label className="block text-gray-700 font-semibold text-sm mb-2">Email Address</label>
							<input
								type="email"
								className={`w-full px-4 py-3 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
									registerErrors.email ? "border-red-500 focus:ring-red-400" : "border-gray-300 focus:ring-yellow-400 focus:border-transparent"
								}`}
								placeholder="Enter your email..."
								value={registerData.email}
								onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
								disabled={isLoading}
								required
							/>
							{registerErrors.email && <p className="text-red-600 text-xs mt-1">⚠️ {registerErrors.email}</p>}
							</div>

							{/* Phone Field */}
							<div>
							<label className="block text-gray-700 font-semibold text-sm mb-2">Phone Number</label>
							<input
								type="tel"
								className={`w-full px-4 py-3 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
									registerErrors.phone ? "border-red-500 focus:ring-red-400" : "border-gray-300 focus:ring-yellow-400 focus:border-transparent"
								}`}
								placeholder="+63 9XX XXX XXXX"
								value={registerData.phone}
								onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
								disabled={isLoading}
								required
							/>
							{registerErrors.phone && <p className="text-red-600 text-xs mt-1">⚠️ {registerErrors.phone}</p>}
							</div>

							{/* Password Field */}
							<div>
							<label className="block text-gray-700 font-semibold text-sm mb-2">Password</label>
							<div className="relative">
								<input
									type={showPassword ? "text" : "password"}
									className={`w-full px-4 py-3 pr-12 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
										registerErrors.password ? "border-red-500 focus:ring-red-400" : "border-gray-300 focus:ring-yellow-400 focus:border-transparent"
									}`}
									placeholder="Enter your password..."
									value={registerData.password}
									onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
									disabled={isLoading}
									required
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									disabled={isLoading}
									className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition disabled:opacity-50"
								>
									{showPassword ? (
										<EyeOff className="w-5 h-5" />
									) : (
										<Eye className="w-5 h-5" />
									)}
								</button>
							</div>
							{registerErrors.password && <p className="text-red-600 text-xs mt-1">⚠️ {registerErrors.password}</p>}
							</div>

							{/* Submit Button */}
							<button
								type="submit"
								disabled={isLoading || Object.keys(registerErrors).length > 0 || !registerData.name || !registerData.email || !registerData.phone || !registerData.password}
								className={`w-full mt-6 px-6 py-3 font-bold rounded-lg shadow-xl transition-all duration-300 transform text-sm ${
									isLoading
										? "bg-yellow-500 text-gray-900 scale-105"
										: "bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 hover:shadow-2xl hover:scale-105 disabled:opacity-50"
								}`}
							>
								{isLoading ? (
									<span className="flex items-center justify-center gap-2">
										<div className="animate-spin h-5 w-5 border-b-2 border-gray-900"></div>
										Creating account...
									</span>
								) : (
									"Create Account"
								)}
							</button>

							{/* Divider */}
							<div className="flex items-center gap-4 my-6">
								<div className="flex-1 h-px bg-gray-300"></div>
								<span className="text-gray-500 text-xs">OR</span>
								<div className="flex-1 h-px bg-gray-300"></div>
							</div>

							{/* Google Login */}
							<a
								href="http://localhost:8000/api/auth/google"
								className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
							>
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
									<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
									<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
									<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
									<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
								</svg>
								Sign up with Google
							</a>
						</form>

						{/* Signup Link */}
						<p className="text-center text-gray-600 text-sm mt-6">
							Already have an account?{" "}
							<button
								type="button"
								onClick={switchToLogin}
								className="text-yellow-600 font-semibold hover:text-yellow-700 transition"
							>
								Sign in here
							</button>
						</p>
					</div>

					{/* Security Info */}
					<motion.p
						className="text-center text-gray-500 text-xs mt-6"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.4 }}
					>
						🔒 Secure authentication • University verified
					</motion.p>
				</div>
				</motion.div>
			</motion.div>
		</div>
	);
}