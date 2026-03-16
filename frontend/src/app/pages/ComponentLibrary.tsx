import { useState } from "react";
import { motion } from "motion/react";
import { 
  CheckCircle, 
  Users, 
  Calendar, 
  TrendingUp, 
  Home, 
  Settings,
  Bell,
  Search,
  ChevronRight
} from "lucide-react";
import StatCard from "@/app/components/shared/StatCard";
import GlassCard from "@/app/components/shared/GlassCard";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Switch } from "@/app/components/ui/switch";
import { Badge } from "@/app/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Progress } from "@/app/components/ui/progress";
import { Slider } from "@/app/components/ui/slider";

export default function ComponentLibrary() {
  const [checked, setChecked] = useState(false);
  const [switchValue, setSwitchValue] = useState(false);
  const [sliderValue, setSliderValue] = useState([50]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Component Library
          </h1>
          <p className="text-xl text-gray-600">
            ConnectEd Design System - All components in one place
          </p>
        </motion.div>

        <div className="space-y-16">
          {/* Role Theme Colors */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Role Theme Colors</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-8 text-white shadow-lg"
              >
                <h3 className="text-2xl font-bold mb-2">Student</h3>
                <p className="text-blue-100">Blue Theme</p>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-8 text-white shadow-lg"
              >
                <h3 className="text-2xl font-bold mb-2">Teacher</h3>
                <p className="text-purple-100">Purple Theme</p>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-8 text-white shadow-lg"
              >
                <h3 className="text-2xl font-bold mb-2">Parent</h3>
                <p className="text-green-100">Green Theme</p>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-8 text-white shadow-lg"
              >
                <h3 className="text-2xl font-bold mb-2">Admin</h3>
                <p className="text-orange-100">Orange Theme</p>
              </motion.div>
            </div>
          </section>

          {/* Stat Cards */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Stat Cards</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Students"
                value="1,234"
                icon={Users}
                gradient="bg-gradient-to-br from-blue-500 to-blue-600"
                trend="+12%"
                trendUp={true}
              />
              <StatCard
                title="Attendance Rate"
                value="96%"
                icon={CheckCircle}
                gradient="bg-gradient-to-br from-green-500 to-green-600"
                trend="+3%"
                trendUp={true}
              />
              <StatCard
                title="Upcoming Events"
                value="8"
                icon={Calendar}
                gradient="bg-gradient-to-br from-purple-500 to-purple-600"
              />
              <StatCard
                title="Performance"
                value="A+"
                icon={TrendingUp}
                gradient="bg-gradient-to-br from-orange-500 to-orange-600"
                trend="-2%"
                trendUp={false}
              />
            </div>
          </section>

          {/* Glass Cards */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Glass Cards</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <GlassCard>
                <h3 className="text-xl font-bold mb-2">Glassmorphism</h3>
                <p className="text-gray-600">Premium design with backdrop blur effect</p>
              </GlassCard>
              <GlassCard gradient="linear-gradient(135deg, rgba(99, 102, 241, 0.8), rgba(139, 92, 246, 0.8))">
                <h3 className="text-xl font-bold mb-2 text-white">With Gradient</h3>
                <p className="text-white/80">Custom gradient background</p>
              </GlassCard>
              <GlassCard>
                <Home className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="text-xl font-bold mb-2">With Icon</h3>
                <p className="text-gray-600">Icon and content combination</p>
              </GlassCard>
            </div>
          </section>

          {/* Buttons */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Buttons</h2>
            <div className="flex flex-wrap gap-4">
              <Button>Default Button</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
              <Button>
                <Settings className="mr-2 h-4 w-4" />
                With Icon
              </Button>
            </div>
          </section>

          {/* Form Components */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Form Components</h2>
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Sample Form</CardTitle>
                <CardDescription>Form components showcase</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" placeholder="Enter your name" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="email@example.com" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" placeholder="Type your message here..." />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="terms" 
                    checked={checked}
                    onCheckedChange={(value) => setChecked(value as boolean)}
                  />
                  <Label htmlFor="terms">Accept terms and conditions</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    id="notifications"
                    checked={switchValue}
                    onCheckedChange={setSwitchValue}
                  />
                  <Label htmlFor="notifications">Enable notifications</Label>
                </div>

                <div className="space-y-2">
                  <Label>Progress</Label>
                  <Progress value={66} className="w-full" />
                </div>

                <div className="space-y-2">
                  <Label>Slider</Label>
                  <Slider 
                    value={sliderValue}
                    onValueChange={setSliderValue}
                    max={100}
                    step={1}
                  />
                  <p className="text-sm text-gray-600">Value: {sliderValue[0]}</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full">Submit Form</Button>
              </CardFooter>
            </Card>
          </section>

          {/* Badges */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Badges</h2>
            <div className="flex flex-wrap gap-3">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge className="bg-blue-500">Student</Badge>
              <Badge className="bg-purple-500">Teacher</Badge>
              <Badge className="bg-green-500">Parent</Badge>
              <Badge className="bg-orange-500">Admin</Badge>
            </div>
          </section>

          {/* Alerts */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Alerts</h2>
            <div className="space-y-4 max-w-2xl">
              <Alert>
                <Bell className="h-4 w-4" />
                <AlertTitle>Default Alert</AlertTitle>
                <AlertDescription>
                  This is a default alert component with an icon.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertTitle>Error Alert</AlertTitle>
                <AlertDescription>
                  This is a destructive alert for error messages.
                </AlertDescription>
              </Alert>
            </div>
          </section>

          {/* Avatars */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Avatars</h2>
            <div className="flex gap-4 items-center">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <Avatar className="h-16 w-16">
                <AvatarFallback>LG</AvatarFallback>
              </Avatar>
            </div>
          </section>

          {/* Tabs */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Tabs</h2>
            <Tabs defaultValue="account" className="w-full max-w-2xl">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="account">
                <Card>
                  <CardHeader>
                    <CardTitle>Account</CardTitle>
                    <CardDescription>
                      Make changes to your account here.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-gray-600">Account settings content goes here.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="password">
                <Card>
                  <CardHeader>
                    <CardTitle>Password</CardTitle>
                    <CardDescription>
                      Change your password here.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-gray-600">Password settings content goes here.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="settings">
                <Card>
                  <CardHeader>
                    <CardTitle>Settings</CardTitle>
                    <CardDescription>
                      Manage your preferences.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-gray-600">General settings content goes here.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </section>

          {/* Cards */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Cards</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Simple Card</CardTitle>
                  <CardDescription>Card with title and description</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">This is the card content area.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-2">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>With Icon</CardTitle>
                  <CardDescription>Card with an icon header</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Icon-enhanced card design.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>With Footer</CardTitle>
                  <CardDescription>Card with footer actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Card with action buttons.</p>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button variant="outline" size="sm">Cancel</Button>
                  <Button size="sm">Confirm</Button>
                </CardFooter>
              </Card>
            </div>
          </section>

          {/* Animated Components */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Animated Components</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer"
              >
                <h3 className="text-xl font-bold mb-2">Hover Animation</h3>
                <p className="text-white/80">Scales and lifts on hover</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg"
              >
                <h3 className="text-xl font-bold mb-2">Entrance Animation</h3>
                <p className="text-white/80">Fades in from the left</p>
              </motion.div>

              <motion.div
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer"
              >
                <h3 className="text-xl font-bold mb-2">Tap Animation</h3>
                <p className="text-white/80">Shrinks on click</p>
              </motion.div>
            </div>
          </section>

          {/* Navigation Components */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Navigation Elements</h2>
            <Card className="max-w-2xl">
              <CardContent className="pt-6 space-y-4">
                <motion.div
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Home className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">Dashboard</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </motion.div>

                <motion.div
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-purple-600" />
                    <span className="font-medium">Settings</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </motion.div>

                <motion.div
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Notifications</span>
                    <Badge className="bg-red-500">3</Badge>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </motion.div>
              </CardContent>
            </Card>
          </section>

          {/* Search Input */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Search Components</h2>
            <div className="max-w-2xl space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  className="pl-10"
                  placeholder="Search students, teachers, classes..."
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center text-gray-600"
        >
          <p className="text-lg mb-2">ConnectEd Component Library</p>
          <p className="text-sm">Built with React, TypeScript, Tailwind CSS, and Framer Motion</p>
        </motion.div>
      </div>
    </div>
  );
}
