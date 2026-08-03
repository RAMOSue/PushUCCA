import { useNavigate } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "../../../context/userContext";
import { LoginModalContext } from "../../../context/LoginModalContext";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Eye, EyeOff, AlertCircle, X as XIcon } from "lucide-react";

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

	// ✅ SLIDESHOW: Fetch images from Master List API
	useEffect(() => {
		const fetchSlideImages = async () => {
			try {
				setSlideshowLoading(true);
				const res = await axios.get(`${import.meta.env.VITE_API_URL || window.location.origin}/api/master-list/slideshow-images`);
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
		}, 10000);
		return () => clearInterval(interval);
	}, [slideImages]);

	const scrollToSection = (sectionId) => {
		document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
				navigate("/staff/manage-requests", { replace: true });
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
					`${import.meta.env.VITE_API_URL || window.location.origin}/api/auth/login`,
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
						navigate("/staff/manage-requests", { replace: true });
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
			const res = await axios.post(`${import.meta.env.VITE_API_URL || window.location.origin}/api/auth/register`, {
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

			{/* ============================================ */}
			{/* SECTION 1: ENHANCED HERO - CULTURAL NARRATIVES */}
			{/* ============================================ */}
			{slideImages.length > 0 ? (
				<Section className="relative w-full h-[320px] sm:h-[460px] md:h-[560px] lg:h-[660px] overflow-hidden bg-[#001800]">
					<AnimatePresence mode="wait">
						<motion.img
							key={slideImages[currentSlide]?.id ?? currentSlide}
							src={slideImages[currentSlide]?.imageUrl}
							alt={slideImages[currentSlide]?.title || "Heritage slideshow"}
							className="absolute inset-0 h-full w-full object-cover"
							initial={{ opacity: 0, x: 30 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -30 }}
							transition={{ duration: 1.4, ease: "easeInOut" }}
						/>
					</AnimatePresence>

					<div className="absolute inset-0 bg-black/45" />

					<motion.div
						className="absolute inset-0 flex flex-col justify-center items-start px-6 sm:px-10 md:px-14 lg:px-20 z-20"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.9, ease: "easeOut" }}
					>
						<p className="uppercase tracking-[0.35em] text-[#92D6A2] text-xs sm:text-sm font-semibold mb-4">
							University Center for Culture and the Arts
						</p>
						<h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[6rem] font-black leading-[0.9] tracking-[-0.04em] text-white mb-6 max-w-3xl font-headline">
							<span className="text-[#004aad]">Du</span>
							<span className="text-[#ffbd59]">Bud</span>
							<span className="text-[#ff3131]">Ka</span>
						</h1>
						<p className="max-w-2xl text-sm sm:text-base md:text-lg text-white/85 mb-8">
							Sa Sining Nagapadayon ang Tingog sa Kaliwatan.
						</p>
						<div className="flex flex-col sm:flex-row gap-4">
							<button
								onClick={() => setShowLoginModal(true)}
								className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#FBBC38] text-[#001800] font-semibold shadow-lg shadow-[#001800]/20 hover:bg-[#f9d86f] transition"
							>
								Sugdan Ta
							</button>
							<button
								onClick={() => scrollToSection("about")}
								className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white/30 text-white hover:border-white hover:bg-white/10 transition"
							>
								Ilhon Ta
							</button>
						</div>
					</motion.div>

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
			{/* SECTION 2: ABOUT UCCA */}
			{/* ============================================ */}
			<Section id="about" className="py-12 md:py-20 px-3 sm:px-4 md:px-6 bg-white" data-section="about">
				<div className="max-w-4xl mx-auto">
					<motion.div
						className="text-center mb-6 md:mb-10"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-headline font-bold text-[#003300] mb-3">
							Ilhon Ta
						</h2>
						<p className="text-sm sm:text-base md:text-lg text-stone-600">
							University Center of Culture and the Arts
						</p>
					</motion.div>

					<motion.div
						className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6"
						variants={containerVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						{/* Point 1 */}
						<motion.div
							variants={itemVariants}
							className="bg-gradient-to-br from-[#003300]/5 to-[#92D6A2]/5 rounded-lg p-4 md:p-6 border border-[#92D6A2]/30"
						>
							<div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-[#004d1a] flex items-center justify-center mb-3">
								<MaterialIcon icon="museum" className="text-white text-lg md:text-xl" />
							</div>
							<h3 className="font-bold text-[#003300] text-sm md:text-base mb-2">Preserves Heritage</h3>
							<p className="text-xs md:text-sm text-stone-700">Protects cultural traditions and artifacts for future generations</p>
						</motion.div>

						{/* Point 2 */}
						<motion.div
							variants={itemVariants}
							className="bg-gradient-to-br from-[#003300]/5 to-[#92D6A2]/5 rounded-lg p-4 md:p-6 border border-[#92D6A2]/30"
						>
							<div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-[#004d1a] flex items-center justify-center mb-3">
								<MaterialIcon icon="stage" className="text-white text-lg md:text-xl" />
							</div>
							<h3 className="font-bold text-[#003300] text-sm md:text-base mb-2">Supports Performances</h3>
							<p className="text-xs md:text-sm text-stone-700">Provides resources for cultural events and celebrations</p>
						</motion.div>

						{/* Point 3 */}
						<motion.div
							variants={itemVariants}
							className="bg-gradient-to-br from-[#003300]/5 to-[#92D6A2]/5 rounded-lg p-4 md:p-6 border border-[#92D6A2]/30"
						>
							<div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-[#004d1a] flex items-center justify-center mb-3">
								<MaterialIcon icon="card_giftcard" className="text-white text-lg md:text-xl" />
							</div>
							<h3 className="font-bold text-[#003300] text-sm md:text-base mb-2">Enables Borrowing</h3>
							<p className="text-xs md:text-sm text-stone-700">Lends authentic items for approved cultural activities</p>
						</motion.div>
					</motion.div>
				</div>
			</Section>

			{/* ============================================ */}
			{/* SECTION 3: OUR CULTURAL DEPARTMENTS (SIMPLIFIED CARDS) */}
			{/* ============================================ */}
			<Section className="py-12 md:py-24 px-3 sm:px-4 md:px-6 bg-gradient-to-b from-white via-white to-[#003300]/5">
				<div className="max-w-6xl mx-auto">
					<motion.div
						className="text-center mb-2 md:mb-4"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<p className="text-[#004d1a] font-bold text-xs uppercase tracking-wider mb-1 md:mb-2">Cultural Excellence</p>
						<h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-headline font-bold text-[#003300]">
							Our Cultural Departments
						</h2>
					</motion.div>

					<p className="text-center text-stone-600 mb-8 md:mb-16 text-xs sm:text-sm md:text-base lg:text-lg max-w-2xl mx-auto px-2">
						Discover our cultural divisions working to preserve traditions and celebrate identity.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-8">
						{/* Department 1: Dulimbay */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -6, boxShadow: "0 25px 50px rgba(0,51,0,0.15)" }}
							onClick={() => toggleDepartment("dulimbay")}
							className={`rounded-lg sm:rounded-xl p-4 sm:p-6 md:p-8 border overflow-hidden transition-all duration-300 cursor-pointer ${
								activeDepartment === "dulimbay"
									? "bg-white border-[#004d1a] ring-2 ring-[#004d1a] shadow-lg"
									: "bg-white border-gray-200 hover:border-[#004d1a]/30 shadow-sm"
							}`}
						>
							<div className="flex items-start justify-between mb-4 md:mb-6">
								<div className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
									<MaterialIcon icon="theater_comedy" className="text-white text-base sm:text-lg md:text-3xl" />
								</div>
								<motion.div animate={{ rotate: activeDepartment === "dulimbay" ? 180 : 0 }} transition={{ duration: 0.3 }}>
									<MaterialIcon icon="expand_more" className="text-[#004d1a] text-lg md:text-2xl" />
								</motion.div>
							</div>
							<h3 className="text-base sm:text-lg md:text-2xl font-bold text-[#003300] mb-1 md:mb-2">Dulimbay</h3>
							<p className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-2 md:mb-4">Dance & Performance</p>
							<p className="text-xs sm:text-sm md:text-sm text-stone-700 leading-relaxed">
								Specializing in traditional cultural dances that express stories of heritage.
							</p>
						</motion.div>

						{/* Department 2: Budjong */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -6, boxShadow: "0 25px 50px rgba(0,51,0,0.15)" }}
							onClick={() => toggleDepartment("budjong")}
							className={`rounded-lg sm:rounded-xl p-4 sm:p-6 md:p-8 border overflow-hidden transition-all duration-300 cursor-pointer ${
								activeDepartment === "budjong"
									? "bg-white border-[#004d1a] ring-2 ring-[#004d1a] shadow-lg"
									: "bg-white border-gray-200 hover:border-[#004d1a]/30 shadow-sm"
							}`}
						>
							<div className="flex items-start justify-between mb-4 md:mb-6">
								<div className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
									<MaterialIcon icon="library_music" className="text-white text-base sm:text-lg md:text-3xl" />
								</div>
								<motion.div animate={{ rotate: activeDepartment === "budjong" ? 180 : 0 }} transition={{ duration: 0.3 }}>
									<MaterialIcon icon="expand_more" className="text-[#004d1a] text-lg md:text-2xl" />
								</motion.div>
							</div>
							<h3 className="text-base sm:text-lg md:text-2xl font-bold text-[#003300] mb-1 md:mb-2">Budjong</h3>
							<p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2 md:mb-4">Music & Instruments</p>
							<p className="text-xs sm:text-sm md:text-sm text-stone-700 leading-relaxed">
								Dedicated to preserving indigenous music and traditional instruments.
							</p>
						</motion.div>

						{/* Department 3: Kayam */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -6, boxShadow: "0 25px 50px rgba(0,51,0,0.15)" }}
							onClick={() => toggleDepartment("kayam")}
							className={`rounded-lg sm:rounded-xl p-4 sm:p-6 md:p-8 border overflow-hidden transition-all duration-300 cursor-pointer ${
								activeDepartment === "kayam"
									? "bg-white border-[#004d1a] ring-2 ring-[#004d1a] shadow-lg"
									: "bg-white border-gray-200 hover:border-[#004d1a]/30 shadow-sm"
							}`}
						>
							<div className="flex items-start justify-between mb-4 md:mb-6">
								<div className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
									<MaterialIcon icon="handcraft" className="text-white text-base sm:text-lg md:text-3xl" />
								</div>
								<motion.div animate={{ rotate: activeDepartment === "kayam" ? 180 : 0 }} transition={{ duration: 0.3 }}>
									<MaterialIcon icon="expand_more" className="text-[#004d1a] text-lg md:text-2xl" />
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
			{/* SECTION 10: WHY IT MATTERS (CTA) */}
			{/* ============================================ */}
			<Section id="mission" className="py-12 md:py-32 px-3 sm:px-4 md:px-6 bg-gradient-to-r from-[#004d1a] via-[#003300] to-[#002108] text-white">
				<div className="max-w-4xl mx-auto text-center">
					<motion.span
						className="text-[#92D6A2] font-bold uppercase tracking-widest text-xs md:text-sm"
						variants={itemVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Our Mission
					</motion.span>
					<motion.h2
						className="text-lg sm:text-2xl md:text-5xl lg:text-6xl font-headline font-bold mt-3 md:mt-6 mb-6 md:mb-10"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Preserving Heritage, Building Community
					</motion.h2>
					<motion.p
						className="text-xs sm:text-sm md:text-lg lg:text-xl text-gray-100 leading-relaxed mb-6 md:mb-12 px-2"
						variants={itemVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						Preserving culture ensures future generations understand their identity and heritage. By borrowing and experiencing these cultural treasures, we keep traditions alive.
					</motion.p>
					<motion.button
						onClick={() => setShowLoginModal(true)}
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						className="mt-2 px-6 sm:px-8 py-2 sm:py-3 md:py-4 bg-[#92D6A2] hover:bg-[#ADF2BC] text-[#003300] font-bold rounded-lg text-sm sm:text-base md:text-lg transition-all"
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
							<h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-gray-900 mb-2">Madiyaw!</h1>
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
									href={`${import.meta.env.VITE_API_URL || window.location.origin}/api/auth/google`}
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
									Create Account
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
									href={`${import.meta.env.VITE_API_URL || window.location.origin}/api/auth/google`}
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
