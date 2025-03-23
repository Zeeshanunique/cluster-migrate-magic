
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/hero/Hero';
import { Check, Users, Shield, Zap, GitBranch, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import BlurContainer from '@/components/ui/BlurContainer';

const Index = () => {
  const features = [
    {
      icon: <Users className="h-5 w-5" />,
      title: 'Unified Authentication',
      description: 'Maintain consistent identity and access management across your multi-cluster environment.'
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: 'Security Preservation',
      description: 'Migrate security policies, RBAC rules, and network configurations intact.'
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: 'Zero Downtime',
      description: 'Perform cluster migrations with minimal to no disruption to your running services.'
    },
    {
      icon: <GitBranch className="h-5 w-5" />,
      title: 'GitOps Integration',
      description: 'Fully integrated with GitOps workflows for declarative cluster management.'
    },
    {
      icon: <PieChart className="h-5 w-5" />,
      title: 'Resource Optimization',
      description: 'Intelligent workload distribution across your multi-cluster environment.'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        <Hero />
        
        {/* Features Section */}
        <section className="py-20 bg-gray-50 dark:bg-gray-900">
          <div className="container px-4 mx-auto">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">
                Streamlined Kubernetes Migration
              </h2>
              <p className="text-lg text-muted-foreground">
                Our platform handles the complex aspects of migrating from single to 
                multi-cluster environments, preserving all your critical configurations.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <BlurContainer 
                  key={index} 
                  className="p-6 rounded-lg h-full"
                  intensity="light"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-medium mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </BlurContainer>
              ))}
            </div>
          </div>
        </section>
        
        {/* How It Works Section */}
        <section className="py-20">
          <div className="container px-4 mx-auto">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">How It Works</h2>
              <p className="text-lg text-muted-foreground">
                A simple step-by-step process to migrate your Kubernetes clusters
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-16 items-center">
              <div className="order-1 md:order-none">
                <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-3">
                  {[
                    'Connect your existing single cluster',
                    'Run our analysis tool to assess migration readiness',
                    'Select your multi-cluster configuration options',
                    'Start automated migration process',
                    'Verify and finalize your new multi-cluster environment'
                  ].map((step, index) => (
                    <li key={index} className="mb-10 ml-6">
                      <span className="absolute flex items-center justify-center w-8 h-8 bg-primary rounded-full -left-4 ring-4 ring-white dark:ring-gray-900 text-white">
                        {index + 1}
                      </span>
                      <p className="text-base font-medium">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
              
              <div className="bg-gray-900 p-8 rounded-lg text-white">
                <div className="flex space-x-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <pre className="text-sm font-mono bg-gray-800 p-4 rounded overflow-x-auto">
                  <code>
{`$ kubemigrate analyze
Analyzing cluster "production"...
✓ Resources identified: 124 pods, 18 services, 12 deployments
✓ Storage: 3 persistent volumes, 2 storage classes
✓ Network: 5 ingress rules, 8 network policies
✓ RBAC: 15 roles, 8 role bindings

Cluster is ready for migration!

$ kubemigrate plan --output=migration-plan.yaml
Migration plan generated successfully.

$ kubemigrate execute --plan=migration-plan.yaml
Starting migration...
Multi-cluster environment created successfully!`}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-cluster-blue to-cluster-indigo text-white">
          <div className="container px-4 mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to modernize your Kubernetes infrastructure?</h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto mb-8">
              Start your journey to a robust multi-cluster environment today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/dashboard">Get Started For Free</Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20" asChild>
                <Link to="/migration">View Demo</Link>
              </Button>
            </div>
          </div>
        </section>
        
        {/* Testimonials Section */}
        <section className="py-20">
          <div className="container px-4 mx-auto">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Trusted by DevOps Teams</h2>
              <p className="text-lg text-muted-foreground">
                See what our customers have to say about their migration experience
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote: "We migrated our entire e-commerce platform to a multi-cluster environment with zero downtime. The process was incredibly smooth.",
                  author: "Sarah Johnson",
                  role: "CTO, Retail Technologies"
                },
                {
                  quote: "KubeMigrate handled the complex authentication transfer perfectly. Our team was impressed with how seamless the transition was.",
                  author: "Michael Chen",
                  role: "DevOps Lead, FinTech Solutions"
                },
                {
                  quote: "The metadata preservation capabilities are outstanding. We didn't lose any of our carefully crafted Kubernetes configurations.",
                  author: "Jessica Williams",
                  role: "Platform Engineer, Cloud Services Inc."
                }
              ].map((testimonial, index) => (
                <BlurContainer 
                  key={index} 
                  className="p-6 rounded-lg flex flex-col h-full"
                >
                  <div className="mb-4 text-amber-500">
                    {Array(5).fill(0).map((_, i) => (
                      <span key={i} className="text-lg">★</span>
                    ))}
                  </div>
                  <p className="text-foreground flex-grow mb-4">"{testimonial.quote}"</p>
                  <div>
                    <p className="font-medium">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </BlurContainer>
              ))}
            </div>
          </div>
        </section>
        
        {/* Benefits Section */}
        <section className="py-20 bg-gray-50 dark:bg-gray-900">
          <div className="container px-4 mx-auto">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Why Choose KubeMigrate?</h2>
              <p className="text-lg text-muted-foreground">
                Our platform offers unique advantages for Kubernetes cluster migration
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {[
                "Automated migration with intelligent validation",
                "Preserved security contexts and authentication",
                "Complete metadata transfer with zero loss",
                "Customizable multi-cluster architecture",
                "Built-in rollback capabilities",
                "Comprehensive audit logs of all migration steps"
              ].map((benefit, index) => (
                <div key={index} className="flex items-start">
                  <div className="mt-1 mr-4 flex-shrink-0 rounded-full p-1 bg-green-50 text-green-600 dark:bg-green-900 dark:text-green-300">
                    <Check className="h-5 w-5" />
                  </div>
                  <p className="text-foreground">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
