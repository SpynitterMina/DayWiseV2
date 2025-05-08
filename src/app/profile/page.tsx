
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useScore } from '@/contexts/ScoreContext';
import { useSpacedRepetition } from '@/contexts/SpacedRepetitionContext'; // Import SR context
import type { Task } from '@/app/page'; // Import Task type
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User as UserIcon, Edit3, Save, Palette, Image as ImageIcon, Check, Loader2, BarChart3, CalendarCheck, Clock, AlertTriangle, TrendingUp, Repeat, LineChart as LineChartIconLucide } from 'lucide-react';
import AvatarWithFrame from '@/components/profile/AvatarWithFrame';
import { rewardService, type RewardDefinition, type OwnedReward, type RewardCategory, type RewardEffect } from '@/services/rewardService';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from 'next/image';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, ResponsiveContainer, Line, LineChart } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import { format, subDays, eachDayOfInterval, parseISO, getDay, isSameDay } from 'date-fns';

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const NONE_VALUE = "_NONE_"; 

export default function ProfilePage() {
  const { profile, updateProfile, refreshEquippedCosmetics, equippedCosmetics } = useUser();
  const { score } = useScore();
  const { tasks: srTasks } = useSpacedRepetition();
  const { toast } = useToast();

  const [isClient, setIsClient] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(profile.username);
  
  const [availableAvatarFrames, setAvailableAvatarFrames] = useState<OwnedReward[]>([]);
  const [availableBanners, setAvailableBanners] = useState<OwnedReward[]>([]);
  const [availableBackgroundColors, setAvailableBackgroundColors] = useState<OwnedReward[]>([]);
  const [availableTitles, setAvailableTitles] = useState<OwnedReward[]>([]);

  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      setNewUsername(profile.username);
      
      const owned = rewardService.getOwnedRewards();
      setAvailableAvatarFrames(owned.filter(r => rewardService.getRewardDefinition(r.id)?.effect?.type === 'avatar_frame'));
      setAvailableBanners(owned.filter(r => rewardService.getRewardDefinition(r.id)?.effect?.type === 'profile_banner'));
      setAvailableBackgroundColors(owned.filter(r => rewardService.getRewardDefinition(r.id)?.effect?.type === 'profile_background'));
      setAvailableTitles(owned.filter(r => rewardService.getRewardDefinition(r.id)?.effect?.type === 'username_style'));

      const storedTasks = localStorage.getItem('daywiseTasks_v4'); // Updated key
      if (storedTasks) {
        try {
          const parsedTasks: Task[] = JSON.parse(storedTasks);
          setDailyTasks(parsedTasks.map(task => ({ // Ensure all new fields are present
            ...task,
            notes: task.notes || '',
            subTasks: task.subTasks || [],
          })));
        } catch (e) {
          console.error("Failed to parse daily tasks for profile analytics", e);
        }
      }
    }
  }, [isClient, profile.username]);


  const handleUsernameSave = () => {
    if (newUsername.trim().length < 3) {
      toast({ title: "Invalid Username", description: "Username must be at least 3 characters.", variant: "destructive"});
      return;
    }
    updateProfile({ username: newUsername.trim() });
    setIsEditingUsername(false);
    toast({ title: "Username Updated!", description: `Your username is now ${newUsername.trim()}.`});
  };

  const handleEquipCosmetic = (rewardId: RewardDefinition['id']) => {
    const definition = rewardService.getRewardDefinition(rewardId);
    if (definition && definition.effect) {
      rewardService.equipCosmetic(rewardId);
      refreshEquippedCosmetics(); 
      toast({ title: "Cosmetic Equipped!", description: `${definition.name} is now active.`});
    }
  };

  const handleUnequipCosmetic = (category: RewardCategory, effectType: RewardEffect['type'], cosmeticName: string) => {
    rewardService.unequipCosmetic(category, effectType);
    refreshEquippedCosmetics();
    toast({ title: `${cosmeticName} Reset`, description: `${cosmeticName} has been reset to default.` });
  };
  
  const analysisData = useMemo(() => {
    if (!isClient) return null;

    const completedTasks = dailyTasks.filter(t => t.completed).length;
    const totalTimeStudiedMinutes = Math.floor(dailyTasks.reduce((acc, t) => acc + (t.actualTimeSpent || 0), 0) / 60);
    const totalSRReviewed = srTasks.reduce((acc, t) => acc + t.timesReviewed, 0);
    const failedTasks = dailyTasks.filter(t => t.failed).length;

    const tasksLast7Days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }).map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const completed = dailyTasks.filter(t => t.completed && t.completedAt && format(parseISO(t.completedAt), 'yyyy-MM-dd') === dateStr).length;
        const failed = dailyTasks.filter(t => t.failed && t.scheduledDate === dateStr).length;
        return { date: format(date, 'MMM d'), completed, failed };
    });
    
    const studyTimeLast7Days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }).map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const timeOnDay = dailyTasks
            .filter(t => (t.completedAt && format(parseISO(t.completedAt), 'yyyy-MM-dd') === dateStr) || (t.scheduledDate === dateStr && t.actualTimeSpent > 0))
            .reduce((sum, t) => sum + (t.actualTimeSpent || 0), 0);
        return { date: format(date, 'MMM d'), hours: parseFloat((timeOnDay / 3600).toFixed(2)) }; // Store as hours
    });
    const totalWeeklyStudyHours = studyTimeLast7Days.reduce((sum, day) => sum + day.hours, 0);


    const taskCategories = dailyTasks.filter(t => t.completed && t.category)
        .reduce((acc, task) => {
            acc[task.category!] = (acc[task.category!] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

    const categoryChartData = Object.entries(taskCategories)
        .map(([name, value], index) => ({ name, value, fill: CHART_COLORS[index % CHART_COLORS.length]}))
        .sort((a,b) => b.value - a.value) 
        .slice(0, 5); 


    return {
        completedTasks,
        totalTimeStudiedMinutes,
        totalSRReviewed,
        failedTasks,
        tasksLast7Days,
        studyTimeLast7Days,
        totalWeeklyStudyHours,
        categoryChartData,
    };
  }, [isClient, dailyTasks, srTasks]);

  const taskActivityChartConfig = useMemo(() => ({
    completed: { label: "Completed", color: "hsl(var(--chart-2))" },
    failed: { label: "Failed", color: "hsl(var(--chart-5))" },
  }), []) satisfies ChartConfig;

  const studyTimeChartConfig = useMemo(() => ({
    hours: { label: "Hours Studied", color: "hsl(var(--chart-1))" },
  }), []) satisfies ChartConfig;

   const categoryChartConfig = useMemo(() => {
    if (!analysisData?.categoryChartData) return {} as ChartConfig;
    return analysisData.categoryChartData.reduce((acc, item) => {
      acc[item.name] = { label: item.name, color: item.fill };
      return acc;
    }, {} as ChartConfig);
  }, [analysisData?.categoryChartData]);


  if (!isClient || !analysisData) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background p-4">
        <div className="animate-pulse text-primary flex flex-col items-center">
          <Loader2 size={64} className="mb-4 animate-spin" />
          <p className="text-2xl font-semibold">Loading Profile...</p>
        </div>
      </div>
    );
  }

  const currentBannerId = equippedCosmetics['Profile Decoration_profile_banner'];
  const currentFrameId = equippedCosmetics['Profile Decoration_avatar_frame'];
  const currentBgColorId = equippedCosmetics['Profile Decoration_profile_background'];
  const currentTitleId = equippedCosmetics['Title_username_style'];

  const cardStyle = profile.profileBackgroundColor ? { backgroundColor: profile.profileBackgroundColor, borderColor: profile.profileBackgroundColor } : {};


  return (
    <div className="space-y-8">
      <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={cardStyle}>
        {profile.bannerUrl ? (
           <Image
            src={profile.bannerUrl}
            alt={`${profile.username}'s banner`}
            width={1200}
            height={250} 
            className="w-full h-40 md:h-48 object-cover" 
            data-ai-hint="profile banner image"
            priority 
          />
        ) : (
          <div className="w-full h-40 md:h-48 bg-muted flex items-center justify-center" data-ai-hint="default banner">
            <ImageIcon size={48} className="text-muted-foreground"/>
          </div>
        )}
        <CardHeader className="items-center text-center -mt-12 md:-mt-16 relative z-10">
          <div className="p-1 bg-card rounded-full inline-block shadow-lg">
             <AvatarWithFrame size={96} /> 
          </div>
          
          {isEditingUsername ? (
            <div className="flex items-center gap-2 mt-3">
              <Input 
                value={newUsername} 
                onChange={(e) => setNewUsername(e.target.value)} 
                className="text-xl md:text-2xl font-bold text-center w-auto"
                maxLength={25}
              />
              <Button size="icon" onClick={handleUsernameSave} aria-label="Save username">
                <Save size={18} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-3">
              <CardTitle className="text-2xl md:text-3xl font-bold flex items-center">
                {profile.username} 
                {profile.title && <span className="ml-2 text-xs md:text-sm font-normal text-accent bg-accent/10 px-2 py-0.5 rounded-full">{profile.title}</span>}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => {setIsEditingUsername(true); setNewUsername(profile.username);}} aria-label="Edit username">
                <Edit3 size={18} />
              </Button>
            </div>
          )}
          <CardDescription className="text-sm md:text-base">Score: {score} points</CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-6 pt-2">
          <p className="text-sm text-muted-foreground">Customize your DayWise experience and track your progress.</p>
        </CardContent>
      </Card>

      <Separator />
      <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center"><Palette className="mr-2 text-primary"/>Cosmetics &amp; Customization</h2>
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">Avatar Frames</CardTitle>
            <CardDescription className="text-xs">Choose a frame.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select 
                value={currentFrameId || NONE_VALUE}
                onValueChange={(value) => { 
                    if(value === NONE_VALUE) {
                        handleUnequipCosmetic('Profile Decoration', 'avatar_frame', 'Avatar Frame');
                    } else if (value) {
                        handleEquipCosmetic(value as RewardDefinition['id']);
                    }
                }}
            >
                <SelectTrigger><SelectValue placeholder="Select frame" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE_VALUE}>Default Frame</SelectItem>
                    {availableAvatarFrames.map(reward => {
                        const def = rewardService.getRewardDefinition(reward.id);
                        if(!def) return null;
                        return <SelectItem key={reward.id} value={reward.id}>{def.name}</SelectItem>;
                    })}
                </SelectContent>
            </Select>
             {availableAvatarFrames.length === 0 && <p className="text-xs text-muted-foreground">No frames owned.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">Profile Banners</CardTitle>
            <CardDescription className="text-xs">Select a banner.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
             <Select 
                value={currentBannerId || NONE_VALUE}
                onValueChange={(value) => { 
                    if(value === NONE_VALUE) {
                         handleUnequipCosmetic('Profile Decoration', 'profile_banner', 'Profile Banner');
                    } else if (value) {
                        handleEquipCosmetic(value as RewardDefinition['id']);
                    }
                }}
            >
                <SelectTrigger><SelectValue placeholder="Select banner" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE_VALUE}>Default Banner</SelectItem>
                    {availableBanners.map(reward => {
                         const def = rewardService.getRewardDefinition(reward.id);
                         if(!def) return null;
                        return <SelectItem key={reward.id} value={reward.id}>{def.name}</SelectItem>;
                    })}
                </SelectContent>
            </Select>
            {availableBanners.length === 0 && <p className="text-xs text-muted-foreground">No banners owned.</p>}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">Background Colors</CardTitle>
            <CardDescription className="text-xs">Set profile card color.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
             <Select 
                value={currentBgColorId || NONE_VALUE}
                onValueChange={(value) => { 
                     if(value === NONE_VALUE) {
                        handleUnequipCosmetic('Profile Decoration', 'profile_background', 'Background Color');
                    } else if (value) {
                        handleEquipCosmetic(value as RewardDefinition['id']);
                    }
                }}
            >
                <SelectTrigger><SelectValue placeholder="Select background" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE_VALUE}>Default Background</SelectItem>
                    {availableBackgroundColors.map(reward => {
                         const def = rewardService.getRewardDefinition(reward.id);
                         if(!def) return null;
                        return <SelectItem key={reward.id} value={reward.id}>{def.name}</SelectItem>;
                    })}
                </SelectContent>
            </Select>
            {availableBackgroundColors.length === 0 && <p className="text-xs text-muted-foreground">No background colors owned.</p>}
          </CardContent>
        </Card>
         <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">Titles</CardTitle>
            <CardDescription className="text-xs">Choose your title.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
             <Select 
                value={currentTitleId || NONE_VALUE}
                onValueChange={(value) => { 
                    if(value === NONE_VALUE) {
                        handleUnequipCosmetic('Title', 'username_style', 'Title');
                    } else if (value) {
                        handleEquipCosmetic(value as RewardDefinition['id']);
                    }
                }}
            >
                <SelectTrigger><SelectValue placeholder="Select title" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE_VALUE}>No Title</SelectItem>
                    {availableTitles.map(reward => {
                         const def = rewardService.getRewardDefinition(reward.id);
                         if(!def) return null;
                        return <SelectItem key={reward.id} value={reward.id}>{def.name} ({def.effect?.value})</SelectItem>;
                    })}
                </SelectContent>
            </Select>
            {availableTitles.length === 0 && <p className="text-xs text-muted-foreground">No titles owned.</p>}
          </CardContent>
        </Card>
      </section>

      <Separator />
      <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center"><BarChart3 className="mr-2 text-primary"/>Your Progress Analytics</h2>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center"><TrendingUp className="mr-2"/>Overall Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-md">
                    <span className="flex items-center text-sm"><CalendarCheck className="mr-2 text-green-500"/> Tasks Completed</span>
                    <span className="font-semibold text-lg">{analysisData.completedTasks}</span>
                </div>
                 <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-md">
                    <span className="flex items-center text-sm"><Clock className="mr-2 text-blue-500"/> Total Time Focused</span>
                    <span className="font-semibold text-lg">{analysisData.totalTimeStudiedMinutes} min</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-md">
                    <span className="flex items-center text-sm"><Repeat className="mr-2 text-purple-500"/> Spaced Repetition Reviews</span>
                    <span className="font-semibold text-lg">{analysisData.totalSRReviewed}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-md">
                    <span className="flex items-center text-sm"><AlertTriangle className="mr-2 text-red-500"/> Tasks Overdue/Failed</span>
                    <span className="font-semibold text-lg">{analysisData.failedTasks}</span>
                </div>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Task Activity (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] md:h-[300px]">
              <ChartContainer config={taskActivityChartConfig} className="w-full h-full">
                <BarChart data={analysisData.tasksLast7Days} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false}/>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="completed" stackId="a" fill="var(--color-completed)" name="Completed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed" stackId="a" fill="var(--color-failed)" name="Failed" radius={[4, 4, 0, 0]}/>
                </BarChart>
              </ChartContainer>
            </CardContent>
             <CardFooter className="text-xs text-muted-foreground">
                 Chart showing completed vs failed tasks over the last 7 days.
             </CardFooter>
        </Card>

        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <LineChartIconLucide className="mr-2 h-5 w-5 text-primary"/>
                    Study Hours (Last 7 Days)
                </CardTitle>
                <CardDescription>Total this week: {analysisData.totalWeeklyStudyHours.toFixed(2)} hours</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] md:h-[300px]">
              <ChartContainer config={studyTimeChartConfig} className="w-full h-full">
                <LineChart data={analysisData.studyTimeLast7Days} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} unit="h" allowDecimals={false}/>
                    <ChartTooltip 
                        content={<ChartTooltipContent indicator="line" />}
                        formatter={(value: number) => `${value}h`}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line type="monotone" dataKey="hours" stroke="var(--color-hours)" strokeWidth={2} dot={{ r: 4, fill: "var(--color-hours)" }} activeDot={{ r: 6 }} name="Hours Studied"/>
                </LineChart>
              </ChartContainer>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
                Line chart showing daily study hours over the last 7 days.
            </CardFooter>
        </Card>


        {analysisData.categoryChartData.length > 0 && (
          <Card className="md:col-span-2">
              <CardHeader>
                  <CardTitle className="text-lg">Top Task Categories (Completed)</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] md:h-[300px] flex items-center justify-center">
                <ChartContainer config={categoryChartConfig} className="w-full h-full min-h-[200px]">
                    <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                        <Pie 
                            data={analysisData.categoryChartData} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={"80%"}
                            labelLine={false}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }: any) => {
                                const RADIAN = Math.PI / 180;
                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                if (percent * 100 < 5) return null; 
                                return (
                                <text x={x} y={y} fill="hsl(var(--card-foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
                                    {`${name} (${(percent * 100).toFixed(0)}%)`}
                                </text>
                                );
                            }}
                        >
                             {analysisData.categoryChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                         <ChartLegend content={<ChartLegendContent payload={
                              analysisData.categoryChartData.map(
                                  (entry) => ({ 
                                  id: entry.name,
                                  type: "square",
                                  value: `${entry.name} (${entry.value})`,
                                  color: entry.fill
                                  })
                              )
                          }/>} />
                    </PieChart>
                </ChartContainer>
              </CardContent>
               <CardFooter className="text-xs text-muted-foreground">
                 Pie chart displaying the distribution of your top completed task categories.
               </CardFooter>
          </Card>
        )}
      </section>
    </div>
  );
}
