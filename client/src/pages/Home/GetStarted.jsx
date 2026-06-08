import { useNavigate, Link } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "../../../context/userContext";
import { LoginModalContext } from "../../../context/LoginModalContext";
import { motion, AnimatePresence } from "framer-motion";
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

const FullScreenWipe = ({ isActive, duration = 0.8 }) => {
	return isActive ? (
		<motion.div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
			<motion.div
				className="absolute inset-0 bg-white"
				initial={{
					// Start fully to the RIGHT for slow-mo visibility
					clipPath: "polygon(120% 8.7%, 100% 8.7%, 100% 100%, 100% 100%)",
				}}
				animate={{
					// Sweep left across the screen
					clipPath: "polygon(-20% 8.7%, 100% 8.7%, 100% 100%, -40% 100%)",
				}}
				transition={{
					duration,
					ease: [0.65, 0, 0.35, 1], // slow → fast cinematic
				}}
			/>
		</motion.div>
	) : null;
};

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

	// ✅ WIPE TRANSITION: Full-screen transition animation
	const [isWiping, setIsWiping] = useState(false);
	const [wipeDuration] = useState(0.4); // Match modal transition: 0.4 seconds

	// ✅ MOBILE DETECTION: For responsive clipPath in modals
	const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

	useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth < 768);
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	// ✅ DEPARTMENT REVEAL PANEL: Interactive department explorer
	const [activeDepartment, setActiveDepartment] = useState(null);
	const [departmentSlideIndex, setDepartmentSlideIndex] = useState({
		dulimbay: 0,
		budjong: 0,
		kayam: 0
	});

	// ✅ DEPARTMENT DATA: Content for each cultural department
	const departmentData = {
		dulimbay: {
			achievements: [
				"Cultural Dance Champion – Regional Festival",
				"University Performing Arts Excellence Award",
				"National Cultural Heritage Recognition"
			],
			events: [
				"Annual Cultural Dance Showcase",
				"Inter-University Dance Exchange",
				"Monthly Traditional Performance Series"
			],
			highlights: [
				"https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=300&fit=crop",
				"https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=300&fit=crop",
				"https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=300&fit=crop"
			]
		},
		budjong: {
			achievements: [
				"Traditional Music Preservation Award",
				"Kulintang Ensemble Recognition",
				"Indigenous Arts Excellence Certificate"
			],
			events: [
				"Kulintang Workshops",
				"Indigenous Music Performances",
				"Traditional Ensemble Training Sessions"
			],
			highlights: [
				"https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=800&h=300&fit=crop",
				"https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=300&fit=crop",
				"https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=300&fit=crop"
			]
		},
		kayam: {
			achievements: [
				"Cultural Research Excellence Award",
				"Indigenous Crafts Preservation Recognition",
				"Heritage Documentation Achievement"
			],
			events: [
				"Cultural Exhibit Displays",
				"Traditional Weaving Workshops",
				"Heritage Documentation Projects"
			],
			highlights: [
				"https://images.unsplash.com/photo-1578500494198-246f612d03b3?w=800&h=300&fit=crop",
				"https://images.unsplash.com/photo-1509328785289-025f5b846b35?w=800&h=300&fit=crop",
				"https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=300&fit=crop"
			]
		}
	};

	// ✅ TOGGLE DEPARTMENT: Open/close department reveal panel
	const toggleDepartment = (dept) => {
		setActiveDepartment(prev => (prev === dept ? null : dept));
		// Reset slideshow index when opening
		if (activeDepartment !== dept) {
			setDepartmentSlideIndex(prev => ({ ...prev, [dept]: 0 }));
		}
	};

	// ✅ AUTO-SLIDE DEPARTMENT HIGHLIGHTS
	useEffect(() => {
		if (!activeDepartment) return;
		const interval = setInterval(() => {
			setDepartmentSlideIndex(prev => ({
				...prev,
				[activeDepartment]: (prev[activeDepartment] + 1) % departmentData[activeDepartment].highlights.length
			}));
		}, 4000);
		return () => clearInterval(interval);
	}, [activeDepartment]);

	// ✅ FALLBACK SLIDESHOW DATA
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
			gradient: "from-purple-500 to-pink-500"
		},
		{
			icon: "library_music",
			title: "Instruments by Region",
			description: "Explore musical heritage and traditional instruments",
			gradient: "from-blue-500 to-cyan-500"
		},
		{
			icon: "public",
			title: "Explore Traditions",
			description: "Learn stories behind cultural practices and rituals",
			gradient: "from-green-500 to-emerald-500"
		},
		{
			icon: "celebrate",
			title: "Cultural Events",
			description: "Join celebrations and experience living heritage",
			gradient: "from-yellow-500 to-orange-500"
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
				const res = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/master-list/slideshow-images`);
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

	// ✅ SECURITY: Email domain validation for register
	const ALLOWED_DOMAINS = ["@carsu.edu.ph", "@gmail.com"];
	const isValidEmail = (email) => {
		return ALLOWED_DOMAINS.some(domain => email.toLowerCase().endsWith(domain));
	};

	const getEmailStatus = () => {
		if (!registerData.email) return null;
		if (isValidEmail(registerData.email)) {
			return { valid: true, message: "✓ Valid email" };
		}
		return {
			valid: false,
			message: `Only ${ALLOWED_DOMAINS.join(" or ")} emails are allowed`,
		};
	};

	const emailStatus = getEmailStatus();

	// ✅ SECURITY: Validate login form (enhanced)
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

	// ✅ SECURITY: Validate register form (enhanced with domain & strength checks)
	const validateRegisterForm = () => {
		const errors = {};
		
		if (!registerData.name.trim()) {
			errors.name = "Name is required";
		} else if (registerData.name.length < 2) {
			errors.name = "Name must be at least 2 characters";
		} else if (registerData.name.length > 100) {
			errors.name = "Name must be less than 100 characters";
		}
		
		if (!registerData.email) {
			errors.email = "Email is required";
		} else if (!isValidEmail(registerData.email)) {
			errors.email = "Only @carsu.edu.ph or @gmail.com emails allowed";
		}
		
		if (!registerData.phone.trim()) {
			errors.phone = "Phone number is required";
		} else if (!/^[0-9+-]{10,}$/.test(registerData.phone.trim())) {
			errors.phone = "Invalid phone number format";
		}
		
		if (!registerData.password) {
			errors.password = "Password is required";
		} else if (registerData.password.length < 8) {
			errors.password = "Password must be at least 8 characters";
		} else if (!/[A-Z]/.test(registerData.password)) {
			errors.password = "Password must contain uppercase letter";
		} else if (!/[a-z]/.test(registerData.password)) {
			errors.password = "Password must contain lowercase letter";
		} else if (!/[0-9]/.test(registerData.password)) {
			errors.password = "Password must contain number";
		} else if (!/[!@#$%^&*]/.test(registerData.password)) {
			errors.password = "Password must contain special character (!@#$%^&*)";
		}
		
		setRegisterErrors(errors);
		return Object.keys(errors).length === 0;
	};

	// ✅ SECURITY: Redirect logged-in users away from public page
	useEffect(() => {
		if (!loading && user) {
			const role = user?.role;
			if (role === "admin") {
				navigate("/admin", { replace: true });
			} else if (role === "staff") {
				navigate("/staff", { replace: true });
			} else {
				navigate("/available-items", { replace: true });
			}
		}
	}, [user, loading, navigate]);

	// ✅ LOGIN: Orchestrate wipe animation timing with API call
	const handleLogin = async (e) => {
		e.preventDefault();
		
		if (isLoginLocked) {
			toast.error("🔐 Too many login attempts. Please try again after 15 minutes.");
			return;
		}

		if (!validateLoginForm()) {
			return;
		}

		// 🎬 START WIPE ANIMATION IMMEDIATELY ON FORM SUBMISSION
		setIsWiping(true);
		const wipingStartTime = Date.now();
		
		setIsLoading(true);
		try {
			const res = await axios.post(
					`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/auth/login`,
			);

			if (res.data.error) {
				setLoginAttempts(prev => prev + 1);
				toast.error(res.data.error);
				setIsWiping(false);
			} else {
				// ✅ SECURITY: Reset attempts on successful login
				setLoginAttempts(0);
				toast.success("✅ Login successful!");
				const loggedInUser = res.data.user;
				setUser(loggedInUser);
				setLoginData({ email: "", password: "" });
				setLoginErrors({});
				
				// Calculate remaining wipe animation time
				const elapsedTime = (Date.now() - wipingStartTime) / 1000;
				const remainingWipeTime = Math.max(0, wipeDuration - elapsedTime);
				
				// Wait for remaining animation time before navigating
				setTimeout(() => {
					const role = loggedInUser.role;
					
					if (role === "admin") {
						navigate("/admin", { replace: true });
					} else if (role === "staff") {
						navigate("/staff", { replace: true });
					} else {
						navigate("/available-items", { replace: true });
					}
				}, remainingWipeTime * 1000);
			}
		} catch (error) {
			setLoginAttempts(prev => prev + 1);
			console.error("Login error:", error.message);
			
			const errorMsg = error.response?.data?.error || "Login failed. Please try again.";
			toast.error(errorMsg);
			
			// Show warning after 3 attempts
			if (loginAttempts >= 2) {
				toast.error(`⚠️ ${5 - loginAttempts - 1} attempts remaining before lock`);
			}
			
			setIsWiping(false);
		} finally {
			setIsLoading(false);
		}
	};

	// ✅ REGISTER: Handle registration with email verification
	const handleRegister = async (e) => {
		e.preventDefault();

		if (!validateRegisterForm()) {
			return;
		}

		const { name, email, password, phone } = registerData;

		// ✅ NEW: Validate allowed email domains
		if (!isValidEmail(email)) {
			toast.error(`Only ${ALLOWED_DOMAINS.join(" or ")} emails are allowed`);
			return;
		}

		setIsLoading(true);
		try {
			const res = await axios.post(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/auth/register`, {
				name,
				email: email.toLowerCase().trim(),
				password,
				phone,
			});

			if (res.data.error) {
				toast.error(res.data.error);
			} else {
				toast.success("✅ Check your email for verification code!");
				setRegisterData({ name: "", email: "", password: "", phone: "" });
				setRegisterErrors({});
				closeRegisterModal();
				// ✅ NEW: Redirect to verification page with email
				navigate("/verify-email", { state: { email } });
			}
		} catch (error) {
			console.error("Registration error:", error.message);
			const errorMsg = error.response?.data?.error || "Registration failed. Please try again.";
			toast.error(errorMsg);
		} finally {
			setIsLoading(false);
		}
	};

	// Show loading state
	if (loading) {
		return (
			<div className="min-h-screen bg-white flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004d1a] mx-auto mb-4"></div>
					<p className="text-[#003300] text-lg">Loading...</p>
				</div>
			</div>
		);
	}

	// Don't render if user is logged in
	if (user) {
		return null;
	}

	return (
		<div className="min-h-screen bg-white overflow-hidden">
			{/* ============================================ */}
			{/* WIPE TRANSITION OVERLAY - In Front of All Pages & Modals */}
			{/* ============================================ */}
			<FullScreenWipe isActive={isWiping} duration={wipeDuration} />

	{/* ✅ NAVIGATION BAR */}
			<nav className="bg-white shadow-2xl z-30 sticky top-0 w-full border-b-2 border-[#004d1a]/10">
				<div className="w-full px-4 md:px-12 py-3 md:py-4 flex items-center justify-between">
					<div className="flex items-center gap-2 md:gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
						<MaterialIcon icon="music_note" className="text-[#003300] text-xl md:text-2xl" />
						<span className="font-headline font-bold text-[#003300] text-sm md:text-lg">UCCA</span>
						<span className="hidden sm:inline font-headline font-bold text-[#003300] text-sm md:text-lg ml-1">Heritage Center</span>
					</div>

					<div className="flex-1" />

					<div className="relative group">
						<button
							onMouseEnter={() => setShowDropdown(true)}
							onMouseLeave={() => setShowDropdown(false)}
							className="px-3 md:px-6 py-2 text-[#003300] font-semibold hover:text-[#004d1a] transition-colors flex items-center gap-1 md:gap-2 text-sm md:text-base"
						>
							About Us
							<MaterialIcon icon={showDropdown ? "expand_less" : "expand_more"} className="text-base md:text-lg" />
						</button>
						{showDropdown && (
							<motion.div
								initial={{ opacity: 0, y: -10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								onMouseEnter={() => setShowDropdown(true)}
								onMouseLeave={() => setShowDropdown(false)}
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

			{/* ============================================ */}
			{/* SECTION 1: ENHANCED HERO - CULTURAL NARRATIVES */}
			{/* ============================================ */}
			{slideImages.length > 0 ? (
				<Section className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] overflow-hidden bg-[#003300]">
					{/* Slides Container */}
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
						<div className="w-full h-full flex-shrink-0 overflow-hidden relative">
							<img
								src={slideImages[currentSlide]?.imageUrl}
								alt="Current"
								className="w-full h-full object-cover"
							/>
							{/* Dark overlay */}
							<div className="absolute inset-0 bg-gradient-to-t from-/70 via-black/40 to-transparent" />
							
							{/* Text overlay with animations */}
							<motion.div
								key={`text-${currentSlide}`}
								className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.8, delay: 0.2 }}
							>
								<h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-headline font-bold mb-4">
									{slideImages[currentSlide]?.title}
								</h2>
								<p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-headline font-light mb-6">
									{slideImages[currentSlide]?.tagline}
								</p>
								<p className="text-xs sm:text-base md:text-lg lg:text-xl font-body text-gray-200">
									{slideImages[currentSlide]?.subtitle}
								</p>
							</motion.div>
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

					{/* Navigation Buttons */}
					<motion.button
						whileHover={{ scale: 1.1 }}
						whileTap={{ scale: 0.95 }}
						onClick={prevSlide}
						className="absolute left-3 md:left-6 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-2 md:p-3 rounded-full z-10"
					>
						<ChevronLeft className="w-4 h-4 md:w-6 md:h-6" />
					</motion.button>

					<motion.button
						whileHover={{ scale: 1.1 }}
						whileTap={{ scale: 0.95 }}
						onClick={nextSlide}
						className="absolute right-3 md:right-6 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 text-white p-2 md:p-3 rounded-full z-10"
					>
						<ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
					</motion.button>

					{/* Slide Indicators */}
					<div className="absolute bottom-3 md:bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2 md:gap-3 z-10">
						{slideImages.map((_, index) => (
							<motion.button
								key={index}
								onClick={() => goToSlide(index)}
								whileHover={{ scale: 1.2 }}
								className={`h-2 rounded-full transition-all ${
									index === currentSlide ? "bg-white w-6 md:w-8" : "bg-white/50 w-2"
								}`}
							/>
						))}
					</div>
				</Section>
			) : (
				<div className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] bg-gradient-to-b from-[#013300] to-[#003300] flex items-center justify-center">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#92D6A2] mx-auto mb-4"></div>
						<p className="text-[#C8EDBA]/60">Loading heritage slideshow...</p>
					</div>
				</div>
			)}

			{/* ============================================ */}
			{/* SECTION 2: ABOUT THE CENTER (IMPROVED SCANNABLE DESIGN) */}
			{/* ============================================ */}
			<Section className="py-16 md:py-24 px-4 md:px-6 bg-gradient-to-b from-white to-[#003300]/5">
				<div className="max-w-6xl mx-auto">
					<motion.h2
						className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-headline font-bold text-center text-[#003300] mb-3 md:mb-4"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						About the University Center of Culture and the Arts
					</motion.h2>

					<motion.p
						className="text-center text-stone-600 mb-10 md:mb-16 text-sm md:text-base lg:text-lg"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Preserving heritage, celebrating identity, strengthening community.
					</motion.p>

					{/* 3-Column Content Grid */}
					<motion.div
						className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8"
						variants={containerVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						{/* Card 1: Our Role */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -4 }}
							className="bg-white rounded-xl p-4 md:p-8 border border-[#004d1a]/10 shadow-sm hover:shadow-lg transition-all"
						>
							<div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-br from-[#004d1a] to-[#003300] flex items-center justify-center mb-4">
								<MaterialIcon icon="museum" className="text-[#92D6A2] text-xl md:text-2xl" />
							</div>
							<h3 className="text-xl font-bold text-[#003300] mb-3">Our Role</h3>
							<p className="text-stone-700 text-sm leading-relaxed">
								The UCCA serves as the heart of cultural preservation at Caraga State University, fostering deep appreciation for our rich heritage.
							</p>
						</motion.div>

						{/* Card 2: What We Do */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -4 }}
							className="bg-white rounded-xl p-4 md:p-8 border border-[#004d1a]/10 shadow-sm hover:shadow-lg transition-all"
						>
							<div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-br from-[#004d1a] to-[#003300] flex items-center justify-center mb-4">
								<MaterialIcon icon="perform_arts" className="text-[#92D6A2] text-xl md:text-2xl" />
							</div>
							<h3 className="text-xl font-bold text-[#003300] mb-3">What We Do</h3>
							<p className="text-stone-700 text-sm leading-relaxed">
								We promote indigenous traditions, performing arts, and material heritage through dedicated programs and meaningful experiences.
							</p>
						</motion.div>

						{/* Card 3: Our Impact */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -4 }}
							className="bg-white rounded-xl p-4 md:p-8 border border-[#004d1a]/10 shadow-sm hover:shadow-lg transition-all"
						>
							<div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-br from-[#004d1a] to-[#003300] flex items-center justify-center mb-4">
								<MaterialIcon icon="handshake" className="text-[#92D6A2] text-xl md:text-2xl" />
							</div>
							<h3 className="text-xl font-bold text-[#003300] mb-3">Our Impact</h3>
							<p className="text-stone-700 text-sm leading-relaxed">
								We engage communities through events, workshops, and cultural initiatives that strengthen bonds and inspire generations.
							</p>
						</motion.div>
					</motion.div>
				</div>
			</Section>

			{/* ============================================ */}
			{/* SECTION 3: OUR CULTURAL DEPARTMENTS (SIMPLIFIED CARDS) */}
			{/* ============================================ */}
			<Section className="py-16 md:py-24 px-4 md:px-6 bg-gradient-to-b from-white via-white to-[#003300]/5">
				<div className="max-w-6xl mx-auto">
					<motion.div
						className="text-center mb-3 md:mb-4"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<p className="text-[#004d1a] font-bold text-xs md:text-sm uppercase tracking-wider mb-2 md:mb-4">Cultural Excellence</p>
						<h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-headline font-bold text-[#003300]">
							Our Cultural Departments
						</h2>
					</motion.div>

					<p className="text-center text-stone-600 mb-10 md:mb-16 text-xs md:text-base lg:text-lg max-w-2xl mx-auto">
						Discover our cultural divisions working to preserve traditions, celebrate identity, and create transformative experiences.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
						{/* Department 1: Dulimbay */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -6, boxShadow: "0 25px 50px rgba(0,51,0,0.15)" }}
							onClick={() => toggleDepartment("dulimbay")}
							className={`rounded-xl p-8 border overflow-hidden transition-all duration-300 cursor-pointer ${
								activeDepartment === "dulimbay"
									? "bg-white border-[#004d1a] ring-2 ring-[#004d1a] shadow-lg"
									: "bg-white border-gray-200 hover:border-[#004d1a]/30 shadow-sm"
							}`}
						>
							<div className="flex items-start justify-between mb-6">
								<div className="w-10 h-10 md:w-14 md:h-14 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
									<MaterialIcon icon="theater_comedy" className="text-white text-xl md:text-3xl" />
								</div>
								<motion.div animate={{ rotate: activeDepartment === "dulimbay" ? 180 : 0 }} transition={{ duration: 0.3 }}>
									<MaterialIcon icon="expand_more" className="text-[#004d1a] text-2xl" />
								</motion.div>
							</div>
							<h3 className="text-lg md:text-2xl font-bold text-[#003300] mb-2">Dulimbay</h3>
							<p className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-4">Dance & Performance</p>
							<p className="text-sm text-stone-700 leading-relaxed">
								Specializing in traditional cultural dances that express stories of heritage and community identity.
							</p>
						</motion.div>

						{/* Department 2: Budjong */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -6, boxShadow: "0 25px 50px rgba(0,51,0,0.15)" }}
							onClick={() => toggleDepartment("budjong")}
							className={`rounded-xl p-8 border overflow-hidden transition-all duration-300 cursor-pointer ${
								activeDepartment === "budjong"
									? "bg-white border-[#004d1a] ring-2 ring-[#004d1a] shadow-lg"
									: "bg-white border-gray-200 hover:border-[#004d1a]/30 shadow-sm"
							}`}
						>
							<div className="flex items-start justify-between mb-6">
								<div className="w-10 h-10 md:w-14 md:h-14 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
									<MaterialIcon icon="library_music" className="text-white text-xl md:text-3xl" />
								</div>
								<motion.div animate={{ rotate: activeDepartment === "budjong" ? 180 : 0 }} transition={{ duration: 0.3 }}>
									<MaterialIcon icon="expand_more" className="text-[#004d1a] text-2xl" />
								</motion.div>
							</div>
							<h3 className="text-lg md:text-2xl font-bold text-[#003300] mb-2">Budjong</h3>
							<p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-4">Music & Instruments</p>
							<p className="text-sm text-stone-700 leading-relaxed">
								Dedicated to preserving indigenous music and traditional instruments that reflect Filipino cultural spirit.
							</p>
						</motion.div>

						{/* Department 3: Kayam */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -6, boxShadow: "0 25px 50px rgba(0,51,0,0.15)" }}
							onClick={() => toggleDepartment("kayam")}
							className={`rounded-xl p-8 border overflow-hidden transition-all duration-300 cursor-pointer ${
								activeDepartment === "kayam"
									? "bg-white border-[#004d1a] ring-2 ring-[#004d1a] shadow-lg"
									: "bg-white border-gray-200 hover:border-[#004d1a]/30 shadow-sm"
							}`}
						>
							<div className="flex items-start justify-between mb-6">
								<div className="w-10 h-10 md:w-14 md:h-14 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
									<MaterialIcon icon="handcraft" className="text-white text-xl md:text-3xl" />
								</div>
								<motion.div animate={{ rotate: activeDepartment === "kayam" ? 180 : 0 }} transition={{ duration: 0.3 }}>
									<MaterialIcon icon="expand_more" className="text-[#004d1a] text-2xl" />
								</motion.div>
							</div>
							<h3 className="text-lg md:text-2xl font-bold text-[#003300] mb-2">Kayam</h3>
							<p className="text-xs font-bold uppercase tracking-wider text-green-600 mb-4">Preservation & Crafts</p>
							<p className="text-sm text-stone-700 leading-relaxed">
								Focusing on cultural research, traditional crafts, and material heritage that tell stories of local communities.
							</p>
						</motion.div>
					</div>

					{/* REVEAL PANEL: Department Details with Enhanced Layout */}
					<AnimatePresence>
						{activeDepartment && (
							<motion.div
								key={activeDepartment}
								initial={{
									height: 0,
									opacity: 0,
									clipPath: "inset(0 0 100% 0)"
								}}
								animate={{
									height: "auto",
									opacity: 1,
									clipPath: "inset(0 0 0% 0)"
								}}
								exit={{
									height: 0,
									opacity: 0,
									clipPath: "inset(0 0 100% 0)"
								}}
								transition={{
									duration: 0.7,
									ease: "easeInOut"
								}}
								className="mt-8 w-full"
							>
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ staggerChildren: 0.12, delayChildren: 0.2 }}
									className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 md:p-8 lg:p-10 overflow-hidden"
								>
									{/* 2-Column Layout */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-10">
										{/* LEFT: Achievements & Events */}
										<motion.div
											initial={{ opacity: 0, x: -20 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ duration: 0.6 }}
										>
											{/* Achievements */}
											<div className="mb-10">
												<h4 className="text-lg font-bold text-[#003300] mb-6 flex items-center gap-3">
													<div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
														<MaterialIcon icon="star" className="text-yellow-600 text-xs md:text-lg" />
													</div>
													Achievements
												</h4>
												<motion.ul
													className="space-y-3"
													variants={containerVariants}
													initial="hidden"
													animate="visible"
												>
													{departmentData[activeDepartment].achievements.map((achievement, idx) => (
														<motion.li
															key={idx}
															variants={itemVariants}
															className="flex gap-3 text-sm text-stone-700"
														>
															<span className="text-[#004d1a] font-bold text-lg mt-1">✓</span>
															<span>{achievement}</span>
														</motion.li>
													))}
												</motion.ul>
											</div>

											{/* Events */}
											<div>
												<h4 className="text-lg font-bold text-[#003300] mb-6 flex items-center gap-3">
													<div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
														<MaterialIcon icon="event" className="text-blue-600 text-lg" />
													</div>
													Events & Programs
												</h4>
												<motion.ul
													className="space-y-3"
													variants={containerVariants}
													initial="hidden"
													animate="visible"
												>
													{departmentData[activeDepartment].events.map((event, idx) => (
														<motion.li
															key={idx}
															variants={itemVariants}
															className="flex gap-3 text-sm text-stone-700"
														>
															<span className="text-blue-600 text-lg mt-1">📅</span>
															<span>{event}</span>
														</motion.li>
													))}
												</motion.ul>
											</div>
										</motion.div>

										{/* RIGHT: Slideshow */}
										<motion.div
											initial={{ opacity: 0, x: 20 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ duration: 0.6 }}
										>
											<div className="relative h-[280px] md:h-[320px] bg-gray-900 flex items-center justify-center group rounded-xl overflow-hidden">
												<motion.img
													key={`${activeDepartment}-${departmentSlideIndex[activeDepartment]}`}
													src={departmentData[activeDepartment].highlights[departmentSlideIndex[activeDepartment]]}
													alt={`${activeDepartment} highlight`}
													initial={{ opacity: 0, scale: 1.05 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0 }}
													transition={{ duration: 0.6 }}
													className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
												/>
												{/* Overlay gradient */}
												<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

												{/* Slide indicators */}
												<div className="absolute bottom-2 md:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1 md:gap-2 z-10">
													{departmentData[activeDepartment].highlights.map((_, idx) => (
														<motion.div
															key={idx}
															className={`h-1 md:h-2 rounded-full transition-all ${
																idx === departmentSlideIndex[activeDepartment]
																	? "w-5 md:w-8 bg-white"
																	: "w-1 md:w-2 bg-white/50"
															}`}
														/>
													))}
												</div>
											</div>
										</motion.div>
									</div>
								</motion.div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</Section>

			{/* ============================================ */}
			{/* SECTION 4: EXPLORE CULTURE CARDS */}
			{/* ============================================ */}
			<Section className="py-16 md:py-24 px-4 md:px-6 bg-white">
				<div className="max-w-6xl mx-auto">
					<motion.div
						className="text-center mb-4"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<p className="text-[#004d1a] font-bold text-sm uppercase tracking-wider mb-4">Start Your Journey</p>
						<h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-headline font-bold text-[#003300] mb-6">
							Explore Our Cultural Collections
						</h2>
					</motion.div>

					<motion.p
						className="text-center text-stone-600 mb-16 text-xs sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Discover the richness of Filipino heritage, traditions, and the stories that connect us
					</motion.p>

					<motion.div
						className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8"
						variants={containerVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						{exploreCultureCards.map((card, idx) => (
							<motion.div
								key={idx}
								variants={itemVariants}
								whileHover={{ y: -10, boxShadow: "0 20px 40px rgba(0,51,0,0.15)" }}
								className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 cursor-pointer overflow-hidden group border border-gray-200"
							>
								<div className={`bg-gradient-to-br ${card.gradient} rounded-lg p-4 mb-4 w-fit group-hover:scale-110 transition-transform duration-300`}>
									<MaterialIcon icon={card.icon} className="text-white text-3xl" />
								</div>
								<h3 className="text-xl font-bold text-[#003300] mb-2">{card.title}</h3>
								<p className="text-stone-600 text-sm">{card.description}</p>
							</motion.div>
						))}
					</motion.div>
				</div>
			</Section>

			{/* ============================================ */}
			{/* SECTION 5: FEATURED CULTURE STORY */}
			{/* ============================================ */}
			<Section className="py-16 md:py-24 px-4 md:px-6 bg-gradient-to-br from-[#003300]/5 to-[#92D6A2]/5">
				<div className="max-w-6xl mx-auto">
					<motion.div
						className="text-center mb-12"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<p className="text-[#004d1a] font-bold text-sm uppercase tracking-wider mb-4">Featured Experience</p>
						<h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-headline font-bold text-[#003300]">
							The Voice of Mindanao
						</h2>
					</motion.div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center">
						{/* Left: Image */}
						<motion.div
							className="rounded-xl overflow-hidden shadow-2xl"
							variants={slideInVariants}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true }}
						>
							<img
								src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop"
								alt="Featured Culture"
								className="w-full h-[250px] sm:h-[300px] md:h-[400px] lg:h-[450px] object-cover"
							/>
						</motion.div>

						{/* Right: Content */}
						<motion.div
							variants={slideInVariants}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true }}
						>
							<span className="text-[#004d1a] font-bold text-sm uppercase tracking-widest">Featured Story</span>
							<h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-headline font-bold text-[#003300] mt-4 mb-6">
								Kulintang: Music of the Ancestors
							</h3>
							<p className="text-stone-700 text-sm md:text-lg lg:text-xl mb-6 leading-relaxed">
								The kulintang is more than brass gongs—it's the heartbeat of Mindanao, resonating through celebrations and rituals across generations. These instruments connect communities to their roots, carrying stories and traditions of ancestors.
							</p>
							<button
								onClick={() => setShowLoginModal(true)}
								className="px-8 py-3 bg-[#004d1a] hover:bg-[#003d15] text-white font-bold rounded-lg transition-all duration-300 inline-flex items-center gap-2"
							>
								Explore This Culture
								<MaterialIcon icon="arrow_forward" className="text-lg" />
							</button>
						</motion.div>
					</div>
				</div>
			</Section>

			{/* ============================================ */}
			{/* SECTION 6: SEARCH & DISCOVER */}
			{/* ============================================ */}
			<Section className="py-16 md:py-24 px-4 md:px-6 bg-gradient-to-b from-white to-[#003300]/5">
				<div className="max-w-6xl mx-auto">
					<motion.div
						className="text-center mb-4"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<p className="text-[#004d1a] font-bold text-sm uppercase tracking-wider mb-4">Interactive Exploration</p>
						<h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-headline font-bold text-[#003300]">
							Search & Discover
						</h2>
					</motion.div>

					<motion.p
						className="text-center text-stone-600 mb-12 text-xs sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Find instruments, costumes, and stories that resonate with you
					</motion.p>

					<div className="relative group mb-8">
						<div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
							<MaterialIcon icon="search" className="text-stone-400 group-focus-within:text-[#004d1a] transition-colors text-2xl" />
						</div>
						<input
							className="w-full h-12 md:h-16 pl-20 pr-6 rounded-xl border-2 border-stone-300 focus:border-[#004d1a] focus:ring-0 text-base md:text-lg font-body transition-all bg-white placeholder-stone-400"
							placeholder="Search instruments, costumes, or cultures..."
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					{/* Filter Dropdowns */}
					<motion.div
						className="grid grid-cols-1 md:grid-cols-3 gap-4"
						variants={containerVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<motion.div variants={itemVariants}>
							<label className="block text-sm font-semibold text-[#003300] mb-2">Culture</label>
							<select
								value={selectedFilters.culture}
								onChange={(e) => setSelectedFilters({ ...selectedFilters, culture: e.target.value })}
								className="w-full px-4 py-2 border-2 border-stone-300 rounded-lg focus:border-[#004d1a] focus:ring-0"
							>
								<option value="all">All Cultures</option>
								<option value="mindanao">Mindanao</option>
								<option value="visayas">Visayas</option>
								<option value="luzon">Luzon</option>
							</select>
						</motion.div>

						<motion.div variants={itemVariants}>
							<label className="block text-sm font-semibold text-[#003300] mb-2">Type</label>
							<select
								value={selectedFilters.type}
								onChange={(e) => setSelectedFilters({ ...selectedFilters, type: e.target.value })}
								className="w-full px-4 py-2 border-2 border-stone-300 rounded-lg focus:border-[#004d1a] focus:ring-0"
							>
								<option value="all">All Types</option>
								<option value="instrument">Instruments</option>
								<option value="costume">Costumes</option>
								<option value="artifact">Artifacts</option>
							</select>
						</motion.div>

						<motion.div variants={itemVariants}>
							<label className="block text-sm font-semibold text-[#003300] mb-2">Event</label>
							<select
								value={selectedFilters.event}
								onChange={(e) => setSelectedFilters({ ...selectedFilters, event: e.target.value })}
								className="w-full px-4 py-2 border-2 border-stone-300 rounded-lg focus:border-[#004d1a] focus:ring-0"
							>
								<option value="all">All Events</option>
								<option value="festival">Festival</option>
								<option value="celebration">Celebration</option>
								<option value="ritual">Ritual</option>
							</select>
						</motion.div>
					</motion.div>
				</div>
			</Section>

			{/* ============================================ */}
			{/* SECTION 7: QUICK LINKS */}
			{/* ============================================ */}
			<Section className="py-16 md:py-24 px-4 md:px-6 bg-white">
				<div className="max-w-6xl mx-auto">
					<motion.div
						className="text-center mb-4"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<p className="text-[#004d1a] font-bold text-sm uppercase tracking-wider mb-4">Quick Navigation</p>
						<h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-headline font-bold text-[#003300]">
							Explore by Interest
						</h2>
					</motion.div>

					<motion.p
						className="text-center text-stone-600 mb-16 text-xs sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Find exactly what you're looking for with quick access to our main features
					</motion.p>

					<motion.div
						className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
						variants={containerVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						{[
							{ icon: "public", label: "Explore Culture", hint: "Discover heritage" },
							{ icon: "auto_stories", label: "Cultural Stories", hint: "Learn traditions" },
							{ icon: "celebrate", label: "Events", hint: "Join celebrations" },
							{ icon: "shopping_bag", label: "Available Items", hint: "Browse collection" },
							{ icon: "bookmark", label: "My Borrowings", hint: "Your items" },
							{ icon: "mail", label: "Contact Us", hint: "Get help" },
						].map((link, idx) => (
							<motion.button
								key={idx}
								variants={itemVariants}
								whileHover={{ y: -4, boxShadow: "0 15px 40px rgba(0,77,26,0.15)" }}
								className="bg-white border-2 border-stone-200 hover:border-[#004d1a] rounded-xl p-4 md:p-6 text-center transition-all"
							>
								<div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-br from-[#004d1a] to-[#003300] flex items-center justify-center mx-auto mb-4">
									<MaterialIcon icon={link.icon} className="text-[#92D6A2] text-xl md:text-2xl" />
								</div>
								<p className="text-base md:text-lg font-bold text-[#003300]">{link.label}</p>
								<p className="text-xs md:text-sm text-stone-500 mt-2">{link.hint}</p>
							</motion.button>
						))}
					</motion.div>
				</div>
			</Section>

			{/* ============================================ */}
			{/* SECTION 8: HOW IT WORKS */}
			{/* ============================================ */}
			<Section className="py-16 md:py-24 px-4 md:px-6 bg-gradient-to-b from-white to-[#003300]/5">
				<div className="max-w-6xl mx-auto">
					<motion.div
						className="text-center mb-4"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<p className="text-[#004d1a] font-bold text-sm uppercase tracking-wider mb-4">Getting Started</p>
						<h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-headline font-bold text-[#003300]">
							How It Works
						</h2>
					</motion.div>

					<motion.p
						className="text-center text-stone-600 mb-16 text-xs sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Simple steps to explore, learn, and engage with our cultural collections
					</motion.p>

					<motion.div
						className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8"
						variants={containerVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						{howItWorks.map((step) => (
							<motion.div
								key={step.step}
								variants={itemVariants}
								className="relative text-center"
							>
								{/* Circle with step number */}
								<div className="flex justify-center mb-6">
									<div className="relative">
										<div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#004d1a] to-[#003300] flex items-center justify-center">
											<MaterialIcon icon={step.icon} className="text-white text-2xl md:text-4xl" />
										</div>
										<div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#92D6A2] flex items-center justify-center text-white font-bold text-sm">
											{step.step}
										</div>
									</div>
								</div>
								<h3 className="text-lg md:text-2xl font-bold text-[#003300] mb-3">{step.title}</h3>
								<p className="text-sm md:text-base text-stone-600 mb-6">{step.description}</p>
								{step.step < 3 && (
									<div className="hidden md:block absolute top-20 -right-10 text-4xl text-stone-300">
										→
									</div>
								)}
							</motion.div>
						))}
					</motion.div>
				</div>
			</Section>

			{/* ============================================ */}
			{/* SECTION 9: TESTIMONIALS */}
			{/* ============================================ */}
			<Section className="py-16 md:py-24 px-4 md:px-6 bg-white">
				<div className="max-w-6xl mx-auto">
					<motion.div
						className="text-center mb-4"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<p className="text-[#004d1a] font-bold text-sm uppercase tracking-wider mb-4">Real Stories</p>
						<h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-headline font-bold text-[#003300]">
							Voices from Our Community
						</h2>
					</motion.div>

					<motion.p
						className="text-center text-stone-600 mb-16 text-xs sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Hear from visitors and community members about their experiences with our cultural collections
					</motion.p>

					<motion.div
						className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8"
						variants={containerVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						{testimonials.map((testimonial, idx) => (
							<motion.div
								key={idx}
								variants={itemVariants}
								whileHover={{ y: -10 }}
								className="bg-white rounded-xl p-4 md:p-8 shadow-lg border-l-4 border-[#92D6A2]"
							>
								<p className="text-stone-700 italic mb-6 text-sm md:text-lg">"{testimonial.text}"</p>
								<div className="flex items-center gap-1 mb-2">
									{[...Array(5)].map((_, i) => (
										<span key={i} className="text-yellow-400">★</span>
									))}
								</div>
								<p className="font-bold text-[#003300]">{testimonial.author}</p>
								<p className="text-xs md:text-sm text-stone-500">{testimonial.role}</p>
							</motion.div>
						))}
					</motion.div>
				</div>
			</Section>

			{/* ============================================ */}
			{/* SECTION 10: WHY IT MATTERS (CTA) */}
			{/* ============================================ */}
			<Section className="py-16 md:py-32 px-4 md:px-6 bg-gradient-to-r from-[#004d1a] via-[#003300] to-[#002108] text-white">
				<div className="max-w-4xl mx-auto text-center">
					<motion.span
						className="text-[#92D6A2] font-bold uppercase tracking-widest text-sm"
						variants={itemVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Our Mission
					</motion.span>
					<motion.h2
						className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-headline font-bold mt-6 mb-10"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Preserving Heritage, Building Community
					</motion.h2>
					<motion.p
						className="text-sm md:text-lg lg:text-xl text-gray-100 leading-relaxed mb-12"
						variants={itemVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Preserving culture ensures that future generations understand their identity and heritage. Every instrument, costume, and artifact tells a story of resilience, creativity, and community pride. By borrowing and experiencing these cultural treasures, we keep traditions alive and honor the wisdom of our ancestors.
					</motion.p>
					<motion.button
						onClick={() => setShowLoginModal(true)}
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						className="mt-2 px-8 py-3 md:py-4 bg-[#92D6A2] hover:bg-[#ADF2BC] text-[#003300] font-bold rounded-lg text-base md:text-lg transition-all"
					>
						Start Your Journey
					</motion.button>
				</div>
			</Section>

			{/* ============================================ */}
			{/* FOOTER */}
			{/* ============================================ */}
			<footer className="w-full border-t border-stone-200 bg-black">
				<div className="w-full px-6 sm:px-12 py-16 flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto">
					<div className="mb-8 md:mb-0">
						<div className="text-[#004d1a] font-bold text-lg font-headline mb-2">CSU Heritage</div>
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

			

			{/* ============================================ */}
			{/* LOGIN & REGISTER MODALS (EXISTING) */}
			{/* ============================================ */}
			{showLoginModal && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.3 }}
					className="fixed inset-0 bg-black/40 z-30 top-0"
					onClick={() => closeLoginModal()}
				/>
			)}

			

			<motion.div
				initial={{ x: "100%" }}
				animate={{ x: showLoginModal ? 0 : "100%" }}
				transition={{ duration: 0.4, ease: "easeInOut" }}
				className="fixed left-0 right-0 top-14 sm:top-16 md:right-0 md:left-auto bottom-0 w-full md:w-1/2 bg-white z-40 overflow-hidden"
				style={{ clipPath: isMobile ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' : 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)' }}
				onClick={(e) => e.stopPropagation()}
			>
			
				
				<button
					onClick={() => closeLoginModal()}
					className="absolute top-3 sm:top-6 right-3 sm:right-6 text-gray-600 hover:text-gray-900 transition z-10"
				>
					<MaterialIcon icon="close" className="text-xl sm:text-2xl" />
				</button>
				

				<motion.div
					initial={{ x: "-100%" }}
					animate={{ x: showLoginModal ? 0 : "-100%" }}
					transition={{ duration: 0.4, ease: "easeInOut" }}
					className="h-full w-full overflow-y-auto p-4 sm:p-8 md:p-12"
				>
					<div className="max-w-md ml-0 md:ml-[180px] mx-auto md:mx-0">
						<div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200">
							<div className="text-center mb-6 sm:mb-8">
							<h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-gray-900 mb-2">Welcome Back</h1>
							</div>

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

							<form onSubmit={handleLogin} className="space-y-5">
								<div>
									<label className="block text-gray-700 font-semibold text-sm mb-2">Email Address</label>
									<input
										type="email"
										className={`w-full px-4 py-3 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
											loginErrors.email ? "border-red-500 focus:ring-red-400" : "border-gray-300 focus:ring-[#004d1a] focus:border-transparent"
										}`}
										placeholder="Enter your email..."
										value={loginData.email}
										onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
										disabled={isLoginLocked || isLoading}
										required
									/>
									{loginErrors.email && <p className="text-red-600 text-xs mt-1">⚠️ {loginErrors.email}</p>}
								</div>

								<div>
									<label className="block text-gray-700 font-semibold text-sm mb-2">Password</label>
									<div className="relative">
										<input
											type={showPassword ? "text" : "password"}
											className={`w-full px-4 py-3 pr-12 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
												loginErrors.password ? "border-red-500 focus:ring-red-400" : "border-gray-300 focus:ring-[#004d1a] focus:border-transparent"
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

								<div className="flex items-center justify-between text-xs">
									<label className="flex items-center gap-2 text-gray-600 cursor-pointer">
										<input type="checkbox" className="rounded" />
										<span>Remember me</span>
									</label>
									<a href="#" className="text-[#004d1a] hover:text-[#003d15] transition">
										Forgot password?
									</a>
								</div>

								<button
									type="submit"
									disabled={isLoading || isLoginLocked || loginErrors.email || loginErrors.password || !loginData.email || !loginData.password}
									className={`w-full mt-6 px-6 py-3 font-bold rounded-lg shadow-xl transition-all duration-300 transform text-sm ${
										isLoginLocked
											? "bg-gray-500 cursor-not-allowed opacity-50 text-gray-300"
											: isLoading
											? "bg-[#004d1a] text-white scale-105"
											: "bg-gradient-to-r from-[#004d1a] to-[#003300] hover:from-[#003d15] hover:to-[#002a0c] text-white hover:shadow-2xl hover:scale-105"
									}`}
								>
									{isLoading ? (
										<span className="flex items-center justify-center gap-2">
											<div className="animate-spin h-5 w-5 border-b-2 border-white"></div>
											Logging in...
										</span>
									) : isLoginLocked ? (
										"🔐 Account Locked (15 min)"
									) : (
										"Log In"
									)}
								</button>

								<div className="flex items-center gap-4 my-6">
									<div className="flex-1 h-px bg-gray-300"></div>
									<span className="text-gray-500 text-xs">OR</span>
									<div className="flex-1 h-px bg-gray-300"></div>
								</div>

								<a
									href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/auth/google`}
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

							<p className="text-center text-gray-600 text-sm mt-6">
								Don't have an account?{" "}
								<button
									type="button"
									onClick={switchToRegister}
									className="text-[#004d1a] font-semibold hover:text-[#003d15] transition"
								>
									Create one here
								</button>
							</p>
						</div>
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

			{showRegisterModal && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.3 }}
					className="fixed inset-0 bg-black/40 z-30 top-0"
					onClick={() => closeRegisterModal()}
				/>
			)}

			<motion.div
				initial={{ x: "100%" }}
				animate={{ x: showRegisterModal ? 0 : "100%" }}
				transition={{ duration: 0.4, ease: "easeInOut" }}
				className="fixed left-0 right-0 top-14 sm:top-16 md:right-0 md:left-auto bottom-0 w-full md:w-1/2 bg-white z-40 overflow-hidden"
				style={{ clipPath: isMobile ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' : 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)' }}
				onClick={(e) => e.stopPropagation()}
			>
				<button
					onClick={() => closeRegisterModal()}
					className="absolute top-3 sm:top-6 right-3 sm:right-6 text-gray-600 hover:text-gray-900 transition z-10"
				>
					<MaterialIcon icon="close" className="text-xl sm:text-2xl" />
				</button>

				<motion.div
					initial={{ x: "-100%" }}
					animate={{ x: showRegisterModal ? 0 : "-100%" }}
					transition={{ duration: 0.4, ease: "easeInOut" }}
					className="h-full w-full overflow-y-auto p-4 sm:p-8 md:p-12"
				>
					<div className="max-w-md ml-0 md:ml-[180px] mx-auto md:mx-0">
						<div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200">
							<div className="text-center mb-6 sm:mb-8">
							<h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-gray-900 mb-2">Create Account</h1>
							</div>

							{/* ✅ NEW: Allowed Email Domains Notice */}
							<div className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg">
								<p className="text-blue-900 text-xs leading-relaxed">
									<strong>ℹ️ Email Required:</strong> You can register with{" "}
									<strong>@carsu.edu.ph</strong> or <strong>@gmail.com</strong> email addresses.
								</p>
							</div>

							<form onSubmit={handleRegister} className="space-y-5">
								<div>
									<label className="block text-gray-700 font-semibold text-sm mb-2">Full Name</label>
									<input
										type="text"
										className={`w-full px-4 py-3 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
											registerErrors.name ? "border-red-500 focus:ring-red-400" : "border-gray-300 focus:ring-[#004d1a] focus:border-transparent"
										}`}
										placeholder="Enter your full name..."
										value={registerData.name}
										onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
										disabled={isLoading}
										required
									/>
									{registerErrors.name && <p className="text-red-600 text-xs mt-1">⚠️ {registerErrors.name}</p>}
								</div>

								<div>
									<label className="block text-gray-700 font-semibold text-sm mb-2">Email Address</label>
									<div className="relative">
										<input
											type="email"
											className={`w-full px-4 py-3 pr-10 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
												emailStatus
													? emailStatus.valid
														? "border-green-400 focus:ring-green-400"
														: "border-red-500 focus:ring-red-400"
													: "border-gray-300 focus:ring-[#004d1a] focus:border-transparent"
											}`}
											placeholder="example@carsu.edu.ph or @gmail.com"
											value={registerData.email}
											onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
											disabled={isLoading}
											required
										/>
										{/* ✅ NEW: Email validation icon */}
										{emailStatus && (
											<div className="absolute right-3 top-1/2 transform -translate-y-1/2">
												{emailStatus.valid ? (
													<span className="text-green-500 text-lg">✓</span>
												) : (
													<span className="text-red-500 text-lg">✕</span>
												)}
											</div>
										)}
									</div>
									{/* ✅ NEW: Email status message */}
									{emailStatus && (
										<p
											className={`text-xs mt-2 ${
												emailStatus.valid
													? "text-green-600"
													: "text-red-600"
											}`}
										>
											{emailStatus.message}
										</p>
									)}
									{registerErrors.email && <p className="text-red-600 text-xs mt-1">⚠️ {registerErrors.email}</p>}
								</div>

								<div>
									<label className="block text-gray-700 font-semibold text-sm mb-2">Phone Number</label>
									<input
										type="tel"
										className={`w-full px-4 py-3 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
											registerErrors.phone ? "border-red-500 focus:ring-red-400" : "border-gray-300 focus:ring-[#004d1a] focus:border-transparent"
										}`}
										placeholder="+63 9XX XXX XXXX"
										value={registerData.phone}
										onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
										disabled={isLoading}
										required
									/>
									{registerErrors.phone && <p className="text-red-600 text-xs mt-1">⚠️ {registerErrors.phone}</p>}
								</div>

								<div>
									<label className="block text-gray-700 font-semibold text-sm mb-2">Password</label>
									<div className="relative">
										<input
											type={showPassword ? "text" : "password"}
											className={`w-full px-4 py-3 pr-12 bg-gray-50 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-300 ${
												registerErrors.password ? "border-red-500 focus:ring-red-400" : "border-gray-300 focus:ring-[#004d1a] focus:border-transparent"
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

								<button
									type="submit"
									disabled={isLoading || !emailStatus?.valid || Object.keys(registerErrors).length > 0 || !registerData.name || !registerData.email || !registerData.phone || !registerData.password}
									className={`w-full mt-6 px-6 py-3 font-bold rounded-lg shadow-xl transition-all duration-300 transform text-sm ${
										isLoading
											? "bg-[#004d1a] text-white scale-105"
											: "bg-gradient-to-r from-[#004d1a] to-[#003300] hover:from-[#003d15] hover:to-[#002a0c] text-white hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
									}`}
								>
									{isLoading ? (
										<span className="flex items-center justify-center gap-2">
											<div className="animate-spin h-5 w-5 border-b-2 border-white"></div>
											Creating account...
										</span>
									) : (
										"Create Account"
									)}
								</button>

								<div className="flex items-center gap-4 my-6">
									<div className="flex-1 h-px bg-gray-300"></div>
									<span className="text-gray-500 text-xs">OR</span>
									<div className="flex-1 h-px bg-gray-300"></div>
								</div>

								<a
									href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/auth/google`}
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

							<p className="text-center text-gray-600 text-sm mt-6">
								Already have an account?{" "}
								<button
									type="button"
									onClick={switchToLogin}
									className="text-[#004d1a] font-semibold hover:text-[#003d15] transition"
								>
									Sign in here
								</button>
							</p>
						</div>

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
