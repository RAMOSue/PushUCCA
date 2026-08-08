import { Suspense, lazy } from "react";
import { Button } from "../../components/ui/button.jsx";

const Spline = lazy(() => import("@splinetool/react-spline"));

function Navbar() {
  const navLinks = ["Services", "About Us", "Projects", "Team", "Contacts"];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-5 lg:px-16">
      <div className="flex items-center justify-between">
        <a href="#" className="text-foreground text-xl font-semibold tracking-tight">
          SENTINEL
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
            >
              {link}
            </a>
          ))}
        </div>

        <Button variant="navCta" size="lg" className="hidden md:inline-flex rounded-lg uppercase text-xs tracking-widest px-6">
          Get Quote
        </Button>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-end bg-hero-bg overflow-hidden">
      <div className="absolute inset-0">
        <Suspense fallback={<div className="absolute inset-0 bg-hero-bg" />}>
          <Spline scene="https://prod.spline.design/Slk6b8kz3LRlKiyk/scene.splinecode" className="w-full h-full" />
        </Suspense>
      </div>

      <div className="absolute inset-0 bg-black/30 z-[1] pointer-events-none" />

      <div className="relative z-10 pointer-events-none w-full max-w-[90%] sm:max-w-md lg:max-w-2xl px-6 md:px-10 pb-10 md:pb-10 pt-32">
        <h1
          className="opacity-0 animate-fade-up text-[clamp(3rem,8vw,6rem)] font-bold leading-[1.05] tracking-[-0.05em] text-foreground mb-2 md:mb-4 uppercase"
          style={{ animationDelay: "0.2s" }}
        >
          SENTINEL <span className="text-primary">AI</span>
        </h1>

        <p
          className="opacity-0 animate-fade-up text-foreground/80 text-[clamp(1.125rem,2.5vw,1.875rem)] font-light mb-3 md:mb-6"
          style={{ animationDelay: "0.4s" }}
        >
          We implement security correctly.
        </p>

        <p
          className="opacity-0 animate-fade-up text-muted-foreground text-[clamp(0.875rem,1.5vw,1.25rem)] font-light mb-4 md:mb-8"
          style={{ animationDelay: "0.55s" }}
        >
          Enterprise security systems built in days. AI-powered surveillance deployed with zero-trust architecture. Smart access control set up for your entire facility. All of it done right, not just fast.
        </p>

        <div className="opacity-0 animate-fade-up flex flex-wrap gap-3 font-bold" style={{ animationDelay: "0.7s" }}>
          <button className="pointer-events-auto bg-primary text-primary-foreground px-6 py-3 md:px-8 md:py-4 text-sm rounded-sm cursor-pointer hover:brightness-110 transition-all active:scale-[0.97]">
            Book a Call
          </button>
          <button className="pointer-events-auto bg-white text-background px-6 py-3 md:px-8 md:py-4 text-sm rounded-sm cursor-pointer hover:brightness-90 transition-all active:scale-[0.97]">
            Our Work
          </button>
        </div>

        <p
          className="opacity-0 animate-fade-up text-muted-foreground/60 text-xs font-light mt-4 md:mt-6"
          style={{ animationDelay: "0.85s" }}
        >
          Trusted security partner. Columbus, OH. 12 systems deployed.
        </p>
      </div>
    </section>
  );
}

export default function GetStarted() {
  return (
    <div className="bg-hero-bg min-h-screen">
      <Navbar />
      <HeroSection />
    </div>
  );
}