import { useState, ChangeEvent, ReactNode, useEffect } from "react";
import { 
  Camera, 
  Upload, 
  Leaf, 
  Droplets, 
  Sun, 
  Thermometer, 
  AlertTriangle, 
  ChevronLeft, 
  Sprout, 
  BookOpen,
  Info,
  Check,
  Star,
  Zap,
  Globe,
  ShieldCheck,
  ArrowRight,
  LogOut,
  User as UserIcon,
  X,
  Lock,
  Mail,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { identifyPlant, CareInstructions } from "./services/ai";
import { supabase } from "./services/supabase";
import { User } from "@supabase/supabase-js";

type AppState = "landing" | "loading" | "result" | "error" | "limit-reached";

interface Profile {
  id: string;
  plan: "Seedling" | "Gardener" | "Botanist";
  usage_count: number;
  last_reset_month: number;
}

export default function App() {
  const [state, setState] = useState<AppState>("landing");
  const [image, setImage] = useState<string | null>(null);
  const [plantData, setPlantData] = useState<CareInstructions | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Auth & Profile States
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isYearly, setIsYearly] = useState(false);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        setShowAuthModal(false);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const newProfile: Profile = {
          id: userId,
          plan: "Seedling",
          usage_count: 0,
          last_reset_month: new Date().getMonth(),
        };
        const { data: createdData, error: createError } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();
        
        if (createError) throw createError;
        setProfile(createdData);
      } else if (error) {
        throw error;
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Fallback: If table doesn't exist, just mock a Seedling profile in state
      setProfile({
        id: userId,
        plan: "Seedling",
        usage_count: 0,
        last_reset_month: new Date().getMonth()
      });
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    
    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        alert("Check your email for the confirmation link!");
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        processImage(base64, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string, displayUrl: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // Check usage limits
    if (profile && profile.plan === "Seedling" && profile.usage_count >= 3) {
      setState("limit-reached");
      return;
    }

    setImage(displayUrl);
    setState("loading");
    try {
      const data = await identifyPlant(base64);
      setPlantData(data);
      
      // Increment usage count in Supabase
      if (profile) {
        const newCount = profile.usage_count + 1;
        const { data: updatedProfile, error } = await supabase
          .from('profiles')
          .update({ usage_count: newCount })
          .eq('id', user.id)
          .select()
          .single();
        
        if (!error && updatedProfile) {
          setProfile(updatedProfile);
        } else {
          // If update fails (e.g. table doesn't exist), update local state anyway for session continuity
          setProfile({ ...profile, usage_count: newCount });
        }
      }

      setState("result");
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to identify plant. Please try a clearer photo.");
      setState("error");
    }
  };

  const reset = (scrollToTop?: boolean | any) => {
    setState("landing");
    setImage(null);
    setPlantData(null);
    setErrorMessage("");
    if (scrollToTop !== false) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const startIdentifying = () => {
    document.getElementById('identifier')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePayment = (plan: string, price: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    if (price === "0") {
      alert("You are now on the Seedling plan!");
      return;
    }

    const options = {
      key: process.env.RAZORPAY_KEY_ID,
      amount: parseFloat(price) * 100, // Amount in paise
      currency: "USD",
      name: "Floradex AI",
      description: `Subscription for ${plan} plan`,
      image: "https://emerald-700-favicon.png", // Placeholder
      handler: async function (response: any) {
        alert(`Payment successful! Payment ID: ${response.razorpay_payment_id}`);
        console.log("Payment Response:", response);
        
        // Update user profile plan in Supabase
        const { data: updatedProfile, error } = await supabase
          .from('profiles')
          .update({ plan: plan as "Seedling" | "Gardener" | "Botanist" })
          .eq('id', user.id)
          .select()
          .single();
          
        if (error) {
          console.error("Error updating plan:", error);
          alert("Payment was successful but we couldn't update your plan. Please contact support.");
        } else {
          setProfile(updatedProfile);
          document.getElementById('identifier')?.scrollIntoView({ behavior: 'smooth' });
        }
      },
      prefill: {
        name: user.email?.split('@')[0],
        email: user.email,
      },
      theme: {
        color: "#047857", // Emerald 700
      },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-olive-900 font-sans selection:bg-olive-200">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#FDFCF8]/80 backdrop-blur-md border-b border-olive-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={reset}>
            <div className="p-2 bg-emerald-700 rounded-xl text-white shadow-lg shadow-emerald-700/20">
              <Sprout size={24} />
            </div>
            <h1 className="text-2xl font-serif font-bold tracking-tight text-olive-800">Floradex</h1>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-olive-700">
            <a href="#features" className="hover:text-emerald-700 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-emerald-700 transition-colors">Pricing</a>
            
            {user ? (
              <div className="flex items-center gap-4 pl-4 border-l border-olive-100">
                <div className="flex items-center gap-2 text-emerald-700">
                  <UserIcon size={18} />
                  <span className="max-w-[120px] truncate">{user.email}</span>
                </div>
                <button 
                  onClick={handleSignOut}
                  className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="px-6 py-2.5 bg-emerald-700 text-white rounded-full hover:bg-emerald-800 transition-all shadow-md active:scale-95"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-emerald-950/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-emerald-50"
            >
              <button 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-8 right-8 p-2 hover:bg-olive-50 text-olive-400 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>

              <div className="p-12">
                <div className="text-center mb-10">
                  <div className="inline-flex p-3 bg-emerald-50 text-emerald-700 rounded-2xl mb-6">
                    <Sprout size={32} />
                  </div>
                  <h3 className="text-3xl font-serif font-bold text-olive-900 mb-2">
                    {authMode === "login" ? "Welcome Back" : "Join Floradex"}
                  </h3>
                  <p className="text-olive-500">
                    {authMode === "login" 
                      ? "Sign in to access your garden profile" 
                      : "Create an account to start identifying"}
                  </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest text-olive-400 ml-4">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-olive-300" size={18} />
                      <input 
                        type="email" 
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-12 pr-6 py-4 bg-olive-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-olive-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest text-olive-400 ml-4">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-olive-300" size={18} />
                      <input 
                        type="password" 
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-12 pr-6 py-4 bg-olive-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-olive-900"
                      />
                    </div>
                  </div>

                  {authError && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3 bg-red-50 text-red-500 text-sm rounded-xl flex items-center gap-2"
                    >
                      <AlertTriangle size={16} />
                      {authError}
                    </motion.div>
                  )}

                  <button 
                    disabled={authLoading}
                    className="w-full py-4 bg-emerald-700 text-white rounded-2xl font-bold text-lg hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-700/20 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {authLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      authMode === "login" ? "Sign In" : "Create Account"
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <button 
                    onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                    className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    {authMode === "login" 
                      ? "Don't have an account? Sign Up" 
                      : "Already have an account? Sign In"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main>
        <AnimatePresence mode="wait">
          {state === "landing" ? (
            <motion.div
              key="landing-page"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Hero Section */}
              <section className="relative pt-32 pb-20 px-6 overflow-hidden">
                <div className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-emerald-50/50 rounded-l-[10rem] blur-3xl" />
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider mb-8">
                      <Star size={14} /> The Future of Gardening is Here
                    </div>
                    <h2 className="text-6xl md:text-8xl font-serif font-medium leading-[1.1] mb-8 text-olive-900">
                      Identify any <br />
                      <span className="italic text-emerald-700">leaf or bloom</span> <br />
                      instantly.
                    </h2>
                    <p className="text-xl text-olive-700/80 mb-10 max-w-lg leading-relaxed">
                      Transform your smartphone into a professional botanist. 
                      Snap a photo and unlock the secrets of your garden with 
                      our state-of-the-art AI.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={startIdentifying}
                        className="flex items-center justify-center gap-2 px-8 py-4 bg-emerald-700 text-white rounded-2xl font-bold text-lg hover:bg-emerald-800 transition-all shadow-xl shadow-emerald-700/20 group"
                      >
                        Start Identifying <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                    
                    <div className="mt-12 flex items-center gap-4 text-sm text-olive-500">
                      <div className="flex -space-x-3">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-olive-100 flex items-center justify-center overflow-hidden">
                            <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" />
                          </div>
                        ))}
                      </div>
                      <span>Joined by <span className="font-bold text-olive-800">10,000+</span> plant lovers</span>
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="relative"
                  >
                    <div className="relative z-10 rounded-[3rem] overflow-hidden shadow-2xl shadow-emerald-900/10">
                      <img 
                        src="https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=1000&auto=format&fit=crop" 
                        alt="Lush Plants" 
                        className="w-full aspect-[4/5] object-cover"
                      />
                    </div>
                    {/* Floating Cards */}
                    <motion.div 
                      animate={{ y: [0, -20, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute -top-10 -right-10 z-20 bg-white p-6 rounded-3xl shadow-xl border border-emerald-50 flex items-center gap-4"
                    >
                      <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                        <Leaf size={24} />
                      </div>
                      <div>
                        <div className="text-xs text-olive-400 font-bold uppercase tracking-wider">Identified</div>
                        <div className="font-serif font-bold text-olive-800 text-lg">Monstera Deliciosa</div>
                      </div>
                    </motion.div>

                    <motion.div 
                      animate={{ y: [0, 20, 0] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                      className="absolute -bottom-10 -left-10 z-20 bg-white p-6 rounded-3xl shadow-xl border border-emerald-50 flex items-center gap-4"
                    >
                      <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                        <Droplets size={24} />
                      </div>
                      <div>
                        <div className="text-xs text-olive-400 font-bold uppercase tracking-wider">Water Level</div>
                        <div className="font-serif font-bold text-olive-800 text-lg">Optimal (85%)</div>
                      </div>
                    </motion.div>
                  </motion.div>
                </div>
              </section>

              {/* Stats Section */}
              <section className="py-20 bg-emerald-900 text-emerald-50">
                <div className="max-w-7xl mx-auto px-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
                    <div>
                      <div className="text-4xl md:text-6xl font-serif font-bold mb-2">99%</div>
                      <div className="text-emerald-300 text-sm uppercase tracking-widest font-bold">Accuracy</div>
                    </div>
                    <div>
                      <div className="text-4xl md:text-6xl font-serif font-bold mb-2">2M+</div>
                      <div className="text-emerald-300 text-sm uppercase tracking-widest font-bold">Species</div>
                    </div>
                    <div>
                      <div className="text-4xl md:text-6xl font-serif font-bold mb-2">24/7</div>
                      <div className="text-emerald-300 text-sm uppercase tracking-widest font-bold">Expert AI</div>
                    </div>
                    <div>
                      <div className="text-4xl md:text-6xl font-serif font-bold mb-2">1s</div>
                      <div className="text-emerald-300 text-sm uppercase tracking-widest font-bold">Response</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Features Section */}
              <section id="features" className="py-32 px-6 bg-white">
                <div className="max-w-7xl mx-auto">
                  <div className="text-center max-w-3xl mx-auto mb-20">
                    <h3 className="text-4xl md:text-6xl font-serif font-medium text-olive-900 mb-6">Everything you need to <span className="italic text-emerald-700">grow.</span></h3>
                    <p className="text-lg text-olive-600">Our features are designed to take the guesswork out of gardening, making you a pro in no time.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard 
                      icon={<Zap className="text-yellow-500" />}
                      title="Instant Identification"
                      description="Snap a photo and our neural network identifies the species in under a second."
                    />
                    <FeatureCard 
                      icon={<BookOpen className="text-blue-500" />}
                      title="Care Library"
                      description="Access thousands of detailed care guides tailored specifically to your plant's needs."
                    />
                    <FeatureCard 
                      icon={<ShieldCheck className="text-emerald-500" />}
                      title="Disease Diagnostic"
                      description="Yellow leaves? Our AI can detect early signs of disease and suggest treatments."
                    />
                    <FeatureCard 
                      icon={<Globe className="text-purple-500" />}
                      title="Global Community"
                      description="Connect with millions of gardeners around the world and share your green progress."
                    />
                    <FeatureCard 
                      icon={<Thermometer className="text-red-500" />}
                      title="Weather Integration"
                      description="Receive alerts when local weather conditions might harm your outdoor plants."
                    />
                    <FeatureCard 
                      icon={<Droplets className="text-sky-500" />}
                      title="Smart Reminders"
                      description="Never forget to water or fertilize again with personalized push notifications."
                    />
                  </div>
                </div>
              </section>

              {/* Identifier Trigger Section */}
              <section id="identifier" className="py-32 px-6 bg-emerald-50">
                <div className="max-w-4xl mx-auto text-center">
                  {user ? (
                    <>
                      <h3 className="text-4xl md:text-6xl font-serif font-medium text-olive-900 mb-12">Identify your plant now</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <label className="group relative flex flex-col items-center justify-center gap-6 p-12 bg-white rounded-[3rem] cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all border-2 border-dashed border-emerald-100 hover:border-emerald-300">
                          <div className="p-6 bg-emerald-100 text-emerald-600 rounded-[2rem] group-hover:scale-110 transition-transform">
                            <Camera size={40} />
                          </div>
                          <div className="text-center">
                            <span className="block text-2xl font-serif font-bold text-olive-800 mb-2">Take a Photo</span>
                            <span className="text-olive-500">Instant camera access</span>
                          </div>
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                        </label>

                        <label className="group relative flex flex-col items-center justify-center gap-6 p-12 bg-white rounded-[3rem] cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all border-2 border-dashed border-emerald-100 hover:border-emerald-300">
                          <div className="p-6 bg-emerald-100 text-emerald-600 rounded-[2rem] group-hover:scale-110 transition-transform">
                            <Upload size={40} />
                          </div>
                          <div className="text-center">
                            <span className="block text-2xl font-serif font-bold text-olive-800 mb-2">Upload Image</span>
                            <span className="text-olive-500">From your gallery</span>
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </label>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white p-16 rounded-[4rem] shadow-xl border border-emerald-50 max-w-2xl mx-auto">
                      <div className="inline-flex p-4 bg-emerald-50 text-emerald-700 rounded-2xl mb-8">
                        <Lock size={40} />
                      </div>
                      <h3 className="text-3xl md:text-5xl font-serif font-medium text-olive-900 mb-6">Ready to identify?</h3>
                      <p className="text-xl text-olive-600 mb-10 leading-relaxed">
                        Sign in to your Floradex account to unlock instant plant 
                        identification and personalized care guides.
                      </p>
                      <button 
                        onClick={() => setShowAuthModal(true)}
                        className="px-10 py-5 bg-emerald-700 text-white rounded-2xl font-bold text-xl hover:bg-emerald-800 transition-all shadow-xl shadow-emerald-700/20 active:scale-95"
                      >
                        Sign In to Start
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Pricing Section */}
              <section id="pricing" className="py-32 px-6 bg-white">
                <div className="max-w-7xl mx-auto">
                  <div className="text-center max-w-3xl mx-auto mb-16">
                    <h3 className="text-4xl md:text-6xl font-serif font-medium text-olive-900 mb-6">Choose your <span className="italic text-emerald-700">growth plan.</span></h3>
                    <p className="text-lg text-olive-600 mb-10">Flexible pricing for casual hobbyists and professional botanists alike.</p>
                    
                    <div className="flex items-center justify-center gap-4">
                      <span className={`text-lg font-medium transition-colors ${!isYearly ? 'text-olive-900' : 'text-olive-400'}`}>Monthly</span>
                      <button 
                        onClick={() => setIsYearly(!isYearly)}
                        className="relative w-16 h-8 bg-emerald-100 rounded-full p-1 transition-colors hover:bg-emerald-200 focus:outline-none"
                      >
                        <motion.div 
                          className="w-6 h-6 bg-emerald-700 rounded-full shadow-md"
                          animate={{ x: isYearly ? 32 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                      <span className={`flex items-center gap-2 text-lg font-medium transition-colors ${isYearly ? 'text-olive-900' : 'text-olive-400'}`}>
                        Yearly
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Save 20%</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                    <PriceCard 
                      tier="Seedling"
                      price="0"
                      billing={isYearly ? "/year" : "/month"}
                      description="Perfect for starting your journey."
                      onSubscribe={() => handlePayment("Seedling", "0")}
                      features={[
                        "3 Identifications Total",
                        "Basic Care Instructions",
                        "Community Access",
                        "Email Support"
                      ]}
                    />
                    <PriceCard 
                      tier="Gardener"
                      price={isYearly ? "95.90" : "9.99"}
                      billing={isYearly ? "/year" : "/month"}
                      popular
                      description="Most popular for home enthusiasts."
                      onSubscribe={() => handlePayment("Gardener", isYearly ? "95.90" : "9.99")}
                      features={[
                        "Unlimited Identifications",
                        "Pro Care Guides",
                        "Disease Diagnosis",
                        "Smart Reminders",
                        "Priority Support",
                        "Ad-free Experience"
                      ]}
                    />
                    <PriceCard 
                      tier="Botanist"
                      price={isYearly ? "479.90" : "49.99"}
                      billing={isYearly ? "/year" : "/month"}
                      description="For professional nurseries & research."
                      onSubscribe={() => handlePayment("Botanist", isYearly ? "479.90" : "49.99")}
                      features={[
                        "Everything in Gardener",
                        "Bulk Identification",
                        "API Access",
                        "Custom Export Formats",
                        "Dedicated Account Manager",
                        "White-label Reports"
                      ]}
                    />
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="py-32 px-6 bg-[#1a2e24]">
                <div className="max-w-5xl mx-auto text-center">
                  <h3 className="text-4xl md:text-7xl font-serif font-medium text-emerald-50 mb-10 leading-tight">Ready to become a <br /> <span className="italic text-emerald-400">master gardener?</span></h3>
                  <button 
                    onClick={startIdentifying}
                    className="px-12 py-6 bg-emerald-400 text-emerald-950 rounded-2xl font-bold text-2xl hover:bg-emerald-300 transition-all shadow-2xl shadow-emerald-400/20 active:scale-95"
                  >
                    Get Floradex Pro Now
                  </button>
                  <p className="mt-8 text-emerald-500/60 font-medium">Join 10k+ users today • 7-day free trial on Pro</p>
                </div>
              </section>

              {/* Footer */}
              <footer className="py-20 px-6 bg-white border-t border-olive-100">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                  <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-2 bg-emerald-700 rounded-xl text-white">
                        <Sprout size={24} />
                      </div>
                      <h1 className="text-2xl font-serif font-bold tracking-tight text-olive-800">Floradex</h1>
                    </div>
                    <p className="text-olive-500 max-w-sm leading-relaxed mb-8">
                      Empowering plant lovers worldwide with advanced AI technology 
                      to nurture and understand the natural world.
                    </p>
                    <div className="flex gap-4">
                      {/* Social icons could go here */}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-olive-800 mb-6 uppercase tracking-widest text-xs">Product</h4>
                    <ul className="space-y-4 text-olive-500 text-sm">
                      <li><a href="#" className="hover:text-emerald-700">Features</a></li>
                      <li><a href="#" className="hover:text-emerald-700">Pricing</a></li>
                      <li><a href="#" className="hover:text-emerald-700">API</a></li>
                      <li><a href="#" className="hover:text-emerald-700">Mobile App</a></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-olive-800 mb-6 uppercase tracking-widest text-xs">Support</h4>
                    <ul className="space-y-4 text-olive-500 text-sm">
                      <li><a href="#" className="hover:text-emerald-700">Help Center</a></li>
                      <li><a href="#" className="hover:text-emerald-700">Terms of Service</a></li>
                      <li><a href="#" className="hover:text-emerald-700">Privacy Policy</a></li>
                      <li><a href="#" className="hover:text-emerald-700">Contact Us</a></li>
                    </ul>
                  </div>
                </div>
                <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-olive-50 text-center text-olive-400 text-xs tracking-widest uppercase font-bold">
                  © 2026 Floradex AI • Built for a Greener Planet
                </div>
              </footer>
            </motion.div>
          ) : (
            <motion.div
              key="app-flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pt-32 pb-20 px-6 max-w-5xl mx-auto"
            >
              <button 
                onClick={reset}
                className="inline-flex items-center gap-2 text-emerald-700 font-bold mb-12 hover:gap-3 transition-all"
              >
                <ChevronLeft size={20} /> Back to Home
              </button>

              {state === "loading" && (
                <div className="flex flex-col items-center justify-center py-24 gap-8">
                  <div className="relative">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-40 h-40 rounded-full border-4 border-emerald-50 border-t-emerald-600"
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                      <Leaf className="animate-pulse" size={48} />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-3xl font-serif italic mb-4 text-olive-900">Analyzing your plant...</h3>
                    <p className="text-olive-500 animate-pulse text-lg">Our AI is consulting the botanical archives</p>
                  </div>
                </div>
              )}

              {state === "result" && plantData && (
                <div className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                    <div className="sticky top-32">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative rounded-[4rem] overflow-hidden shadow-2xl shadow-emerald-900/10"
                      >
                        <img 
                          src={image || ""} 
                          alt={plantData.commonName} 
                          className="w-full aspect-[4/5] object-cover"
                        />
                        <div className="absolute top-8 right-8 px-6 py-2 bg-white/90 backdrop-blur-sm text-emerald-700 rounded-full text-sm font-bold shadow-lg">
                          {plantData.difficulty} level
                        </div>
                      </motion.div>
                    </div>

                    <div className="space-y-12">
                      <div>
                        <h2 className="text-6xl font-serif font-medium text-olive-900 mb-4 leading-tight">
                          {plantData.commonName}
                        </h2>
                        <p className="text-2xl font-serif italic text-emerald-600 mb-8 font-light">
                          {plantData.scientificName}
                        </p>
                        <p className="text-olive-700 leading-relaxed text-xl">
                          {plantData.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <CareCard 
                          icon={<Droplets />} 
                          title="Watering" 
                          content={plantData.watering} 
                        />
                        <CareCard 
                          icon={<Sun />} 
                          title="Sunlight" 
                          content={plantData.sunlight} 
                        />
                        <CareCard 
                          icon={<Thermometer />} 
                          title="Environment" 
                          content={`${plantData.temperature} • ${plantData.soil}`} 
                        />
                        <CareCard 
                          icon={<AlertTriangle />} 
                          title="Toxicity" 
                          content={plantData.toxicity} 
                          alert={!plantData.toxicity.toLowerCase().includes("non-toxic")}
                        />
                      </div>

                      <div className="bg-emerald-50/50 p-10 rounded-[3rem] border border-emerald-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-emerald-100 -z-10">
                          <Info size={120} />
                        </div>
                        <h4 className="flex items-center gap-3 text-2xl font-serif font-bold mb-8 text-olive-900">
                          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                            <Info size={24} />
                          </div>
                          Pro Growth Tips
                        </h4>
                        <ul className="space-y-6">
                          {plantData.tips.map((tip, idx) => (
                            <motion.li 
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="flex gap-4 text-olive-700 text-lg leading-relaxed"
                            >
                              <div className="mt-2.5 w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                              <span>{tip}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                      
                      <button 
                        onClick={reset}
                        className="w-full py-6 bg-emerald-700 text-white rounded-3xl font-bold text-xl hover:bg-emerald-800 transition-all active:scale-[0.98] shadow-2xl shadow-emerald-700/20"
                      >
                        Identify Another Plant
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {state === "error" && (
                <div className="text-center py-24 space-y-8">
                  <div className="w-32 h-32 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8">
                    <AlertTriangle size={64} />
                  </div>
                  <h3 className="text-4xl font-serif font-medium text-olive-900">Deep apologies...</h3>
                  <p className="text-xl text-olive-600 max-w-md mx-auto leading-relaxed">
                    {errorMessage}
                  </p>
                  <button 
                    onClick={reset}
                    className="px-12 py-5 bg-olive-800 text-white rounded-2xl font-bold text-lg hover:bg-olive-900 transition-all shadow-xl"
                  >
                    Back to Safety
                  </button>
                </div>
              )}

              {state === "limit-reached" && (
                <div className="text-center py-24 space-y-12">
                  <div className="relative inline-block">
                    <div className="w-40 h-40 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <Zap size={64} fill="currentColor" />
                    </div>
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-950 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg"
                    >
                      Limit Reached
                    </motion.div>
                  </div>
                  
                  <div className="max-w-xl mx-auto">
                    <h3 className="text-5xl font-serif font-medium text-olive-900 mb-6 leading-tight">
                      Your green thumb <br /> needs <span className="italic text-emerald-700">more space.</span>
                    </h3>
                    <p className="text-xl text-olive-600 mb-12 leading-relaxed">
                      You've used all 3 free identifications. 
                      Upgrade to the **Gardener** plan for unlimited scans and pro guides.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button 
                        onClick={() => {
                          reset(false);
                          setTimeout(() => {
                            document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        }}
                        className="px-12 py-6 bg-emerald-700 text-white rounded-2xl font-bold text-xl hover:bg-emerald-800 transition-all shadow-2xl shadow-emerald-700/20 active:scale-95"
                      >
                        Upgrade to Pro
                      </button>
                      <button 
                        onClick={reset}
                        className="px-12 py-6 bg-white border border-olive-200 text-olive-800 rounded-2xl font-bold text-xl hover:bg-olive-50 transition-all"
                      >
                        Maybe Later
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="p-10 bg-white rounded-[3rem] border border-olive-50 shadow-sm hover:shadow-2xl hover:shadow-emerald-900/5 transition-all"
    >
      <div className="mb-6 p-4 bg-gray-50 rounded-2xl inline-block">
        {icon}
      </div>
      <h4 className="text-2xl font-serif font-bold text-olive-900 mb-4">{title}</h4>
      <p className="text-olive-500 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function PriceCard({ tier, price, billing = "/month", description, features, onSubscribe, popular = false }: { 
  tier: string, 
  price: string, 
  billing?: string,
  description: string, 
  features: string[], 
  onSubscribe: () => void,
  popular?: boolean 
}) {
  return (
    <motion.div 
      whileHover={{ scale: popular ? 1.05 : 1.02 }}
      className={`relative p-10 rounded-[3rem] border transition-all ${
        popular 
          ? 'bg-[#1a2e24] text-white border-emerald-500/50 shadow-2xl scale-105 z-10' 
          : 'bg-white text-olive-900 border-olive-100 shadow-xl'
      }`}
    >
      {popular && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-emerald-400 text-emerald-950 rounded-full text-sm font-black uppercase tracking-widest">
          Most Popular
        </div>
      )}
      <div className="mb-8">
        <h4 className="text-2xl font-serif font-bold mb-2">{tier}</h4>
        <p className={`${popular ? 'text-emerald-400/80' : 'text-olive-400'} text-sm`}>{description}</p>
      </div>
      <div className="mb-10 flex items-baseline gap-1">
        <span className="text-5xl font-serif font-bold">${price}</span>
        <span className={`${popular ? 'text-emerald-400/60' : 'text-olive-300'} font-medium`}>{billing}</span>
      </div>
      <ul className="space-y-5 mb-10">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-3">
            <div className={`p-1 rounded-full ${popular ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-100 text-emerald-700'}`}>
              <Check size={14} />
            </div>
            <span className={`${popular ? 'text-emerald-50' : 'text-olive-700'} font-medium`}>{feature}</span>
          </li>
        ))}
      </ul>
      <button 
        onClick={onSubscribe}
        className={`w-full py-5 rounded-2xl font-bold transition-all active:scale-95 ${
        popular 
          ? 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300' 
          : 'bg-olive-800 text-white hover:bg-olive-900'
      }`}>
        {price === "0" ? "Start for Free" : "Subscribe Now"}
      </button>
    </motion.div>
  );
}

function CareCard({ icon, title, content, alert = false }: { 
  icon: ReactNode; 
  title: string; 
  content: string;
  alert?: boolean;
}) {
  return (
    <div className={`p-8 rounded-[2.5rem] border transition-all ${
      alert 
        ? 'bg-red-50/50 border-red-100' 
        : 'bg-white border-emerald-50 hover:border-emerald-200 shadow-sm'
    }`}>
      <div className={`mb-4 flex items-center gap-3 ${alert ? 'text-red-600' : 'text-emerald-600'}`}>
        <div className={`p-2 rounded-lg ${alert ? 'bg-red-100' : 'bg-emerald-100'}`}>
          {icon}
        </div>
        <span className="text-xs uppercase tracking-widest font-black opacity-60">{title}</span>
      </div>
      <p className={`text-lg leading-relaxed font-medium ${alert ? 'text-red-900' : 'text-olive-800'}`}>
        {content}
      </p>
    </div>
  );
}
