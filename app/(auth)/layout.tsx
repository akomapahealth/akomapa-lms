import Image from "next/image";

const currentYear = new Date().getFullYear();

const AuthLayout = ({
    children
}: {
    children: React.ReactNode
}) => {
    return ( 
        <div className="min-h-screen flex flex-col md:flex-row">
            {/* Left side - Image section */}
            <div className="hidden md:block md:w-1/2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-akomapa-teal/90 via-akomapa-teal-dark/85 to-akomapa-teal/90 z-10" />
                <Image 
                    src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=2670&auto=format&fit=crop"
                    alt="Healthcare professionals training"
                    fill
                    className="object-cover hover-scale transition-transform duration-700"
                    priority
                />
                <div className="relative z-20 h-full flex flex-col justify-center items-center text-white p-8">
                    <div className="max-w-md text-center animate-slide-in">
                        {/* Gold accent cross - matching Akomapa branding */}
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="w-8 h-3 bg-akomapa-gold rounded-sm" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-8 bg-akomapa-gold rounded-sm" />
                            </div>
                        </div>
                        
                        <div className="relative mb-8">
                            <h2 className="text-4xl font-bold mb-4 hover-lift inline-block">Welcome to Akomapa LMS</h2>
                            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-akomapa-gold rounded-full hover-scale"></div>
                        </div>
                        <p className="text-lg opacity-90 mb-4">
                            Empowering the next generation of health leaders through student-powered, expert-supervised learning.
                        </p>
                        <p className="text-base opacity-80 italic">
                            &quot;Nya Akomapa&quot; — Have a good heart
                        </p>
                        
                        {/* Feature Cards Grid */}
                        <div className="grid grid-cols-2 gap-4 mt-8">
                            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg hover-lift group border border-white/20">
                                <div className="flex items-center mb-2">
                                    <div className="w-8 h-8 rounded-full bg-akomapa-gold/30 flex items-center justify-center mr-2 group-hover:bg-akomapa-gold/50 transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                    </div>
                                    <h3 className="font-semibold">Train Anywhere</h3>
                                </div>
                                <p className="text-sm opacity-80">Access health courses from any device, anytime</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg hover-lift group border border-white/20">
                                <div className="flex items-center mb-2">
                                    <div className="w-8 h-8 rounded-full bg-akomapa-gold/30 flex items-center justify-center mr-2 group-hover:bg-akomapa-gold/50 transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <h3 className="font-semibold">Expert Mentors</h3>
                                </div>
                                <p className="text-sm opacity-80">Learn from healthcare professionals</p>
                            </div>
                        </div>

                        {/* Interactive Stats */}
                        <div className="mt-8 grid grid-cols-3 gap-4">
                            <div className="text-center hover-lift">
                                <div className="text-2xl font-bold mb-1 text-akomapa-gold">500+</div>
                                <div className="text-sm opacity-80">Patients Served</div>
                            </div>
                            <div className="text-center hover-lift">
                                <div className="text-2xl font-bold mb-1 text-akomapa-gold">10+</div>
                                <div className="text-sm opacity-80">Partner Institutions</div>
                            </div>
                            <div className="text-center hover-lift">
                                <div className="text-2xl font-bold mb-1 text-akomapa-gold">100+</div>
                                <div className="text-sm opacity-80">Student Leaders</div>
                            </div>
                        </div>

                        {/* Trust Indicators */}
                        <div className="mt-8 flex items-center justify-center space-x-4">
                            <div className="flex items-center space-x-2 hover-lift">
                                <svg className="w-5 h-5 text-akomapa-gold" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm">Community-Rooted</span>
                            </div>
                            <div className="flex items-center space-x-2 hover-lift">
                                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm">Expert-Supervised</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right side - Auth form section */}
            <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 md:p-12 bg-akomapa-cream">
                <div className="w-full max-w-md">
                    {/* Logo and Brand */}
                    <div className="flex flex-col items-center mb-8 animate-scale-in">
                        <div className="flex items-center space-x-4 mb-4">
                            <Image 
                                height={200}
                                width={200}
                                alt="Akomapa Health Logo" 
                                src="/akomapa-logo.png"
                                className="object-contain hover-rotate"
                            />
                            {/* <div className="text-center">
                                <h1 className="text-3xl font-bold text-akomapa-teal">Akomapa LMS</h1>
                                <p className="text-sm text-gray-600">Training Health Leaders</p>
                            </div> */}
                        </div>
                        <div className="flex space-x-4 mt-4">
                            <div className="w-2 h-2 rounded-full bg-akomapa-teal hover-scale" />
                            <div className="w-2 h-2 rounded-full bg-akomapa-gold hover-scale" />
                            <div className="w-2 h-2 rounded-full bg-akomapa-teal-light hover-scale" />
                        </div>
                    </div>

                    {/* Auth Form */}
                    <div className="bg-white rounded-lg shadow-sm p-6 hover-lift animate-fade-in border border-akomapa-light-blue/30">
                        {children}
                    </div>

                    {/* Social Proof */}
                    <div className="mt-8 text-center animate-fade-in">
                        <div className="flex justify-center space-x-8 mb-4">
                            <div className="text-center hover-lift">
                                <p className="text-2xl font-bold text-akomapa-teal">4</p>
                                <p className="text-sm text-gray-600">Countries</p>
                            </div>
                            <div className="text-center hover-lift">
                                <p className="text-2xl font-bold text-akomapa-teal">5+</p>
                                <p className="text-sm text-gray-600">Programs</p>
                            </div>
                            <div className="text-center hover-lift">
                                <p className="text-2xl font-bold text-akomapa-teal">501(c)(3)</p>
                                <p className="text-sm text-gray-600">Nonprofit</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 text-center text-sm text-gray-600 animate-fade-in">
                        <p>© {currentYear} Akomapa Health Foundation. All rights reserved.</p>
                        <div className="flex justify-center space-x-4 mt-2">
                            <a href="https://www.akomapa.org" target="_blank" rel="noopener noreferrer" className="hover:text-akomapa-teal transition-colors duration-300 hover-lift">Visit Website</a>
                            <a href="#" className="hover:text-akomapa-teal transition-colors duration-300 hover-lift">Privacy Policy</a>
                            <a href="#" className="hover:text-akomapa-teal transition-colors duration-300 hover-lift">Contact Us</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
 
export default AuthLayout;
