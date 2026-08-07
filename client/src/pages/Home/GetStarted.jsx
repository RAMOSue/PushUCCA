import { useLocation, useNavigate } from "react-router-dom";
import { useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "../../../context/userContext";
import { LoginModalContext } from "../../../context/LoginModalContext";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Eye, EyeOff, AlertCircle, X as XIcon, PersonStanding, Music4, Guitar } from "lucide-react";
import tokenManager from "../../utils/tokenManager";

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
const Section = ({ children, className = "", id, ...props }) => (
	<motion.section
		id={id}
		initial={{ opacity: 0 }}
		whileInView={{ opacity: 1 }}
		transition={{ duration: 0.8 }}
		viewport={{ once: true, amount: 0.2 }}
		className={className}
		{...props}
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
	const { user, loading, setUser, setLoading } = useContext(UserContext);
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
	const location = useLocation();
	const departmentsSectionRef = useRef(null);

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
	const [nextSlide, setNextSlide] = useState(0);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const [slideshowLoading, setSlideshowLoading] = useState(true);
	const [slideshowTransitionDuration] = useState(10.8);
	const [slideshowAutoAdvanceDelay] = useState(10000);
	const swipeTimeoutRef = useRef(null);
	const autoplayTimeoutRef = useRef(null);

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
		budyong: 0,
		kayam: 0
	});

	// ✅ DEPARTMENT DATA: Content for each cultural department
	const departmentData = {
		dulimbay: {
			description:
				"Dulimbay comes from the words Dula and Limbay, representing theater and dance. The department promotes indigenous dances, contemporary performances, stage productions, and cultural storytelling that preserve the traditions and identity of the community.",
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
		budyong: {
			description:
				"Budjong is named after the traditional shell trumpet, a cultural instrument used to communicate and gather communities. The department focuses on music, vocal performances, traditional instruments, and preserving the rich musical heritage of Caraga.",
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
			description:
				"Kayam represents the university's contemporary band, blending modern musical expression with cultural appreciation. Through vocals, guitars, drums, keyboards, and other instruments, the department showcases artistic excellence while celebrating Filipino identity.",
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
	const scrollToDepartments = () => {
		const section = departmentsSectionRef.current;
		if (!section) return;
		const top = section.getBoundingClientRect().top + window.scrollY - 90;
		window.scrollTo({ top, behavior: "smooth" });
	};

	const toggleDepartment = (dept) => {
		if (activeDepartment === dept) {
			setActiveDepartment(null);
			requestAnimationFrame(() => scrollToDepartments());
			return;
		}

		setActiveDepartment(dept);
		setDepartmentSlideIndex(prev => ({ ...prev, [dept]: 0 }));
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
				const orderedImages = [...images]
					.sort((a, b) => (Number(a.display_order ?? 0) - Number(b.display_order ?? 0)) || (Number(a.id ?? 0) - Number(b.id ?? 0)));
				setSlideImages(orderedImages.length > 0 ? orderedImages : culturalNarratives);
			} catch (err) {
				console.error("Failed to fetch slideshow images:", err);
				setSlideImages(culturalNarratives);
			} finally {
				setSlideshowLoading(false);
			}
		};
		fetchSlideImages();
	}, []);

	// ✅ SLIDESHOW: Auto-transition effect with a cinematic gradient wipe
	useEffect(() => {
		return () => {
			if (autoplayTimeoutRef.current) {
				window.clearTimeout(autoplayTimeoutRef.current);
			}
			if (swipeTimeoutRef.current) {
				window.clearTimeout(swipeTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (slideImages.length <= 1 || isTransitioning) return;

		autoplayTimeoutRef.current = window.setTimeout(() => {
			const upcomingSlide = (currentSlide + 1) % slideImages.length;
			setNextSlide(upcomingSlide);
			setIsTransitioning(true);
		}, slideshowAutoAdvanceDelay);

		return () => {
			if (autoplayTimeoutRef.current) {
				window.clearTimeout(autoplayTimeoutRef.current);
				autoplayTimeoutRef.current = null;
			}
		};
	}, [slideImages.length, currentSlide, isTransitioning, slideshowAutoAdvanceDelay]);

	useEffect(() => {
		if (!isTransitioning) return;

		if (swipeTimeoutRef.current) {
			window.clearTimeout(swipeTimeoutRef.current);
		}

		swipeTimeoutRef.current = window.setTimeout(() => {
			setCurrentSlide(nextSlide);
			setNextSlide(nextSlide);
			setIsTransitioning(false);
			swipeTimeoutRef.current = null;
		}, slideshowTransitionDuration * 1000);

		return () => {
			if (swipeTimeoutRef.current) {
				window.clearTimeout(swipeTimeoutRef.current);
				swipeTimeoutRef.current = null;
			}
		};
	}, [isTransitioning, nextSlide, slideshowTransitionDuration]);

	const scrollToSection = (sectionId) => {
		const target = document.getElementById(sectionId);
		if (!target) return;

		const header = document.querySelector('header');
		const navbarHeight = header ? header.getBoundingClientRect().height : 0;
		const offset = Math.max(16, navbarHeight + 16);
		const targetTop = target.getBoundingClientRect().top + window.scrollY - offset;

		window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
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

	const clearRegisterError = (field) => {
		setRegisterErrors((prev) => {
			if (!prev[field]) return prev;
			const next = { ...prev };
			delete next[field];
			return next;
		});
	};

	const handleRegisterFieldChange = (field, value) => {
		setRegisterData((prev) => ({ ...prev, [field]: value }));
		clearRegisterError(field);
	};

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

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const googleMode = params.get("google_mode");
		const googleName = params.get("google_name");
		const googleEmail = params.get("google_email");
		const googleError = params.get("google_error");
		const googleSuccess = params.get("google_success");
		const googleToken = params.get("token");
		const googleUser = params.get("user");

		if (googleError) {
			toast.error(decodeURIComponent(googleError));
		}

		if (googleMode === "login" && googleSuccess === "1" && googleToken && googleUser) {
			try {
				const parsedUser = JSON.parse(decodeURIComponent(googleUser));
				persistAuthSession(parsedUser, googleToken, "✅ Google login successful!");
				navigateBasedOnRole(parsedUser);
			} catch (error) {
				console.error("Failed to process Google login callback:", error);
				toast.error("Google sign-in failed. Please try again.");
			}
			window.history.replaceState({}, document.title, window.location.pathname);
			return;
		}

		if (googleMode === "login") {
			setShowLoginModal(true);
			setShowRegisterModal(false);
			window.history.replaceState({}, document.title, window.location.pathname);
			return;
		}

		if (googleName || googleEmail) {
			setRegisterData((prev) => ({
				...prev,
				name: googleName ? decodeURIComponent(googleName) : prev.name,
				email: googleEmail ? decodeURIComponent(googleEmail).toLowerCase() : prev.email,
				password: "",
				phone: "",
			}));
			setRegisterErrors({});
			setShowRegisterModal(true);
			setShowLoginModal(false);
			window.history.replaceState({}, document.title, window.location.pathname);
		}
	}, [location.search, setShowRegisterModal, setShowLoginModal]);

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

	const persistAuthSession = (loggedInUser, token, successMessage = "✅ Login successful!") => {
		if (token && loggedInUser?.id) {
			tokenManager.addToken(loggedInUser.id, loggedInUser.email, token, {
				name: loggedInUser.name,
				role: loggedInUser.role,
				phone: loggedInUser.phone,
			});
			tokenManager.setActiveToken(loggedInUser.id);
		}

		setUser(loggedInUser);
		setLoading(false);
		setLoginData({ email: "", password: "" });
		setLoginErrors({});
		setRegisterData({ name: "", email: "", password: "", phone: "" });
		setRegisterErrors({});
		setShowRegisterModal(false);
		setShowLoginModal(false);
		toast.success(successMessage);
	};

	const navigateBasedOnRole = (userData) => {
		const role = userData?.role;
		if (role === "admin") {
			navigate("/admin", { replace: true });
		} else if (role === "staff") {
			navigate("/staff/manage-requests", { replace: true });
		} else {
			navigate("/available-items", { replace: true });
		}
	};

	const authenticateWithCredentials = async ({ email, password, successMessage = "✅ Login successful!" }) => {
		const res = await axios.post(
			`${import.meta.env.VITE_API_URL || window.location.origin}/api/auth/login`,
			{
				email: email.trim().toLowerCase(),
				password,
			},
			{ withCredentials: true }
		);

		if (res.data.error) {
			throw new Error(res.data.error);
		}

		const loggedInUser = res.data.user;
		const token = res.data.token;
		persistAuthSession(loggedInUser, token, successMessage);
		return loggedInUser;
	};

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
			await authenticateWithCredentials({
				email: loginData.email,
				password: loginData.password,
				successMessage: "✅ Login successful!",
			});

			// ✅ SECURITY: Reset attempts on successful login
			setLoginAttempts(0);
			
			// Calculate remaining wipe animation time
			const elapsedTime = (Date.now() - wipingStartTime) / 1000;
			const remainingWipeTime = Math.max(0, wipeDuration - elapsedTime);
			
			// Wait for remaining animation time before navigating
			setTimeout(() => {
				navigateBasedOnRole(user);
			}, remainingWipeTime * 1000);
		} catch (error) {
			setLoginAttempts(prev => prev + 1);
			console.error("Login error:", error.message);
			
			const errorMsg = error.response?.data?.error || error.message || "Login failed. Please try again.";
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

		setIsWiping(true);
		const wipingStartTime = Date.now();
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
				return;
			}

			const normalizedEmail = email.toLowerCase().trim();
			setLoginData((prev) => ({ ...prev, email: normalizedEmail }));

			const registrationUser = res.data?.user;
			const registrationToken = res.data?.token;
			if (registrationUser && registrationToken) {
				persistAuthSession(registrationUser, registrationToken, "🎉 Account created! You’re now signed in.");
				const elapsedTime = (Date.now() - wipingStartTime) / 1000;
				const remainingWipeTime = Math.max(0, wipeDuration - elapsedTime);
				setTimeout(() => {
					navigateBasedOnRole(registrationUser);
				}, remainingWipeTime * 1000);
			} else {
				const loggedInUser = await authenticateWithCredentials({
					email: normalizedEmail,
					password,
					successMessage: "🎉 Account created! You’re now signed in.",
				});
				const elapsedTime = (Date.now() - wipingStartTime) / 1000;
				const remainingWipeTime = Math.max(0, wipeDuration - elapsedTime);
				setTimeout(() => {
					navigateBasedOnRole(loggedInUser);
				}, remainingWipeTime * 1000);
			}
		} catch (error) {
			console.error("Registration error:", error.message);
			const errorMsg = error.response?.data?.error || error.message || "Registration failed. Please try again.";
			toast.error(errorMsg);
			setIsWiping(false);
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

	const currentHeroImage = slideImages[currentSlide] || null;
	const upcomingHeroImage = isTransitioning ? (slideImages[nextSlide] || currentHeroImage) : null;

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
						<div className="absolute inset-0">
						{upcomingHeroImage ? (
							<img
								src={upcomingHeroImage.imageUrl}
								alt={upcomingHeroImage.title || "Heritage slideshow"}
								className="absolute inset-0 h-full w-full object-cover z-0"
							/>
						) : null}
						{currentHeroImage ? (
							<motion.img
								key={`${currentSlide}-${nextSlide}-${isTransitioning ? "transition" : "idle"}`}
								src={currentHeroImage.imageUrl}
								alt={currentHeroImage.title || "Heritage slideshow"}
								className="absolute inset-0 h-full w-full object-cover z-10"
								initial={isTransitioning ? { WebkitMaskPosition: "100% 50%", maskPosition: "100% 50%" } : false}
								animate={isTransitioning ? {
									WebkitMaskPosition: "-100% 50%",
									maskPosition: "-100% 50%",
								} : false}
								transition={isTransitioning ? { duration: slideshowTransitionDuration, ease: [0.23, 1, 0.32, 1] } : { duration: 0 }}
								style={isTransitioning ? {
									WebkitMaskImage: "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 10%, rgba(0,0,0,0.22) 24%, rgba(0,0,0,0.46) 42%, rgba(0,0,0,0.72) 60%, rgba(0,0,0,0.92) 78%, rgba(0,0,0,1) 100%)",
									maskImage: "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 10%, rgba(0,0,0,0.22) 24%, rgba(0,0,0,0.46) 42%, rgba(0,0,0,0.72) 60%, rgba(0,0,0,0.92) 78%, rgba(0,0,0,1) 100%)",
									WebkitMaskSize: "220% 100%",
									maskSize: "220% 100%",
									WebkitMaskRepeat: "no-repeat",
									maskRepeat: "no-repeat",
									willChange: "mask-position",
								} : {
									WebkitMaskImage: "none",
									maskImage: "none",
								}}
							/>
						) : null}
					</div>
					<motion.div
						className="absolute inset-0 flex flex-col justify-center items-center sm:items-start text-center sm:text-left px-4 sm:px-8 md:px-14 lg:px-20 z-20"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.9, ease: "easeOut" }}
					>
						<h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem] font-black leading-[0.95] tracking-[-0.04em] text-white mb-5 max-w-full sm:max-w-3xl font-headline">
							<span className="text-[#004aad]">Du</span>
							<span className="text-[#ffbd59]">Bud</span>
							<span className="text-[#ff3131]">Ka</span>
						</h1>
						<p className="uppercase tracking-[0.2em] text-[#92D6A2] text-[0.72rem] sm:text-[0.8rem] md:text-[0.9rem] lg:text-base font-medium leading-6 mb-4 max-w-full">
							Sa Sining Nagapadayon ang Tingog sa Kaliwatan.
						</p>
						<p className="max-w-full sm:max-w-2xl text-xs sm:text-sm md:text-base leading-relaxed text-white/85 mb-6">
							Through Art, Culture Continues Across Generations.
						</p>
						<div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start w-full">
							<button
								onClick={() => setShowLoginModal(true)}
								className="inline-flex items-center justify-center rounded-full px-4 py-2.5 sm:px-5 sm:py-2 text-sm font-semibold bg-[#FBBC38] text-[#001800] shadow-sm shadow-[#001800]/20 hover:bg-[#f9d86f] transition"
							>
								Sugdan Ta
							</button>
							<button
								onClick={() => scrollToSection("about")}
								className="inline-flex items-center justify-center rounded-full px-4 py-2.5 sm:px-5 sm:py-2 text-sm border border-white/30 text-white hover:border-white hover:bg-white/10 transition"
							>
								Ilahon Ta
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
			<Section id="about" className="py-16 md:py-20 px-3 sm:px-4 md:px-6 bg-white" data-section="about">
				<div className="max-w-6xl mx-auto">
					<motion.div
						className="text-center mb-8 md:mb-10"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-headline font-bold text-[#003300] mb-3">
							About Us
						</h2>
						<p className="text-sm sm:text-base md:text-lg text-stone-600 max-w-3xl mx-auto leading-relaxed">
							The University Center for Culture and the Arts (UCCA) preserves, promotes, and celebrates the rich cultural heritage of Caraga through dance, music, theater, and cultural preservation. It nurtures creativity, strengthens cultural identity, and inspires future generations through the arts.
						</p>
					</motion.div>

					<div className="w-20 h-px bg-[#92D6A2] mx-auto mb-8 md:mb-10" />

					<motion.div
						className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6"
						variants={containerVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<motion.div
							variants={itemVariants}
							className="rounded-2xl border border-stone-200 bg-white p-6 md:p-7 text-center shadow-sm hover:shadow-md transition-shadow duration-300"
						>
							<h3 className="font-headline text-lg font-semibold text-[#003300] mb-2">Mission</h3>
							<p className="text-sm leading-relaxed text-stone-600">
								To preserve, promote, and advance culture and the arts through education, creativity, and community engagement.
							</p>
						</motion.div>

						<motion.div
							variants={itemVariants}
							className="rounded-2xl border border-stone-200 bg-white p-6 md:p-7 text-center shadow-sm hover:shadow-md transition-shadow duration-300"
						>
							<h3 className="font-headline text-lg font-semibold text-[#003300] mb-2">Vision</h3>
							<p className="text-sm leading-relaxed text-stone-600">
								A vibrant cultural center that inspires artistic excellence and safeguards the heritage of future generations.
							</p>
						</motion.div>

						<motion.div
							variants={itemVariants}
							className="rounded-2xl border border-stone-200 bg-white p-6 md:p-7 text-center shadow-sm hover:shadow-md transition-shadow duration-300"
						>
							<h3 className="font-headline text-lg font-semibold text-[#003300] mb-2">Established</h3>
							<p className="text-sm leading-relaxed text-stone-600">
								Established in <span className="font-semibold text-[#003300]">1980</span>, UCCA has served as the university's center for preserving and promoting culture and the arts.
							</p>
						</motion.div>
					</motion.div>
				</div>
			</Section>

			{/* ============================================ */}
			{/* SECTION 3: OUR CULTURAL DEPARTMENTS */}
			{/* ============================================ */}
			<Section className="py-12 md:py-24 px-3 sm:px-4 md:px-6 bg-gradient-to-b from-white via-white to-[#003300]/5">
				<div className="max-w-6xl mx-auto" ref={departmentsSectionRef}>
					<motion.div
						className="text-center mb-2 md:mb-4"
						variants={slideInVariants}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-headline font-bold text-[#003300]">
							Departments
						</h2>
					</motion.div>

					<p className="text-center text-stone-600 mb-8 md:mb-10 text-xs sm:text-sm md:text-base lg:text-lg max-w-2xl mx-auto px-2">
						Every department is a living expression of art, preserving traditions and revealing the beauty of our culture.
					</p>

					<AnimatePresence mode="wait">
						{activeDepartment && (
							<motion.div
								key={activeDepartment}
								initial={{ clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)" }}
								animate={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}
								exit={{ clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)" }}
								transition={{ duration: 0.55, ease: [0.16, 0.84, 0.44, 1] }}
								className="relative left-1/2 mb-6 w-screen -ml-[50vw] overflow-hidden md:mb-8"
							>
								<div className="w-full overflow-hidden bg-[#003300] px-3 pt-4 pb-8 text-white sm:px-6 sm:pt-5 sm:pb-10 md:px-10 md:pt-6 md:pb-12 lg:px-14 lg:pt-7 lg:pb-14">
									<div className="mx-auto flex w-full max-w-6xl flex-col">
										<div className="mx-auto w-full max-w-3xl text-center">
											<button
												type="button"
												onClick={() => toggleDepartment(activeDepartment)}
												className="w-full cursor-pointer pt-0 text-center transition duration-300 hover:text-white/80"
												aria-label={`Collapse ${activeDepartment === "dulimbay" ? "Dulimbay" : activeDepartment === "budyong" ? "Budyong" : "Kayam"} details`}
											>
												<h3 className="text-3xl font-medium uppercase tracking-[0.22em] text-white sm:text-4xl md:text-5xl">
													{activeDepartment === "dulimbay" ? "DULIMBAY" : activeDepartment === "budyong" ? "BUDYONG" : "KAYAM"}
												</h3>
											</button>
											<p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
												{departmentData[activeDepartment].description}
											</p>
										</div>

										<div className="relative mx-auto mt-6 h-[260px] w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-stone-900 sm:h-[320px]">
											<motion.img
												key={`${activeDepartment}-${departmentSlideIndex[activeDepartment]}`}
												src={departmentData[activeDepartment].highlights[departmentSlideIndex[activeDepartment]]}
												alt={`${activeDepartment} highlight`}
												className="h-full w-full object-cover"
											/>
											<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
											<div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
												{departmentData[activeDepartment].highlights.map((_, idx) => (
													<div
														key={idx}
														className={`h-1.5 rounded-full transition-all ${
															idx === departmentSlideIndex[activeDepartment] ? "w-7 bg-white" : "w-2 bg-white/60"
														}`}
													/>
												))}
											</div>
										</div>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					<motion.div
						animate={{ y: activeDepartment ? 28 : 0 }}
						transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
						className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-8"
					>
						{/* Department 1: Dulimbay */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -3, scale: 1.01 }}
							onClick={() => toggleDepartment("dulimbay")}
							className={`flex min-h-[84px] items-center justify-center rounded-xl p-3 text-center shadow-sm transition-all duration-300 sm:min-h-[92px] sm:p-4 md:min-h-[100px] md:p-5 ${
								activeDepartment === "dulimbay"
									? "bg-[#2563eb] text-white shadow-md"
									: "cursor-pointer bg-[#eff6ff] text-[#1e3a8a] hover:bg-[#dbeafe]"
							}`}
						>
							<h3 className="text-sm font-medium tracking-[0.16em] sm:text-base md:text-lg">Dulimbay</h3>
						</motion.div>

						{/* Department 2: Budjong */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -3, scale: 1.01 }}
							onClick={() => toggleDepartment("budyong")}
							className={`flex min-h-[84px] items-center justify-center rounded-xl p-3 text-center shadow-sm transition-all duration-300 sm:min-h-[92px] sm:p-4 md:min-h-[100px] md:p-5 ${
								activeDepartment === "budyong"
									? "bg-[#d4a017] text-[#1f1a0f] shadow-md"
									: "cursor-pointer bg-[#fff8e8] text-[#8a5c00] hover:bg-[#fef3c7]"
							}`}
						>
							<h3 className="text-sm font-medium tracking-[0.16em] sm:text-base md:text-lg">Budjong</h3>
						</motion.div>

						{/* Department 3: Kayam */}
						<motion.div
							variants={itemVariants}
							whileHover={{ y: -3, scale: 1.01 }}
							onClick={() => toggleDepartment("kayam")}
							className={`flex min-h-[84px] items-center justify-center rounded-xl p-3 text-center shadow-sm transition-all duration-300 sm:min-h-[92px] sm:p-4 md:min-h-[100px] md:p-5 ${
								activeDepartment === "kayam"
									? "bg-[#d9480f] text-white shadow-md"
									: "cursor-pointer bg-[#fff1ed] text-[#9a2c0d] hover:bg-[#ffe4db]"
							}`}
						>
							<h3 className="text-sm font-medium tracking-[0.16em] sm:text-base md:text-lg">Kayam</h3>
						</motion.div>
					</motion.div>
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
									href={`${import.meta.env.VITE_API_URL || window.location.origin}/api/auth/google?mode=login`}
									className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
								>
									<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
										<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
										<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
										<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
										<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
									</svg>
									Continue with Google
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
										onChange={(e) => handleRegisterFieldChange("name", e.target.value)}
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
											onChange={(e) => handleRegisterFieldChange("email", e.target.value)}
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
										onChange={(e) => handleRegisterFieldChange("phone", e.target.value)}
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
											onChange={(e) => handleRegisterFieldChange("password", e.target.value)}
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
									disabled={isLoading}
									className={`w-full mt-6 px-6 py-3 font-bold rounded-lg shadow-xl transition-all duration-300 transform text-sm ${
										isLoading
											? "bg-[#004d1a] text-white scale-105"
											: "bg-gradient-to-r from-[#004d1a] to-[#003300] hover:from-[#003d15] hover:to-[#002a0c] text-white hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
									}`}
								>
									{isLoading ? (
										<span className="inline-flex items-center justify-center gap-2">
											<div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"></div>
											<span>Creating Account...</span>
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
									href={`${import.meta.env.VITE_API_URL || window.location.origin}/api/auth/google?mode=register`}
									className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
								>
									<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
										<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
										<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
										<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
										<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
									</svg>
									Continue with Google
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

					</div>
				</motion.div>
			</motion.div>
		</div>
	);
}
