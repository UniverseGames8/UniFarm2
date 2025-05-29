import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Users, 
  TrendingUp,
  RefreshCw,
  Zap,
  AlertCircle
} from 'lucide-react';

interface SystemHealth {
  status: string;
  databaseConnected: boolean;
  activeUsers: number;
  totalTransactions: number;
  avgResponseTime: number;
  systemLoad: 'low' | 'medium' | 'high';
  lastUpdate: string;
}

interface PerformanceReport {
  totalOperations: number;
  avgDuration: number;
  successRate: number;
  slowOperations: Array<{
    operation: string;
    duration: number;
    timestamp: string;
    status: string;
  }>;
  operationStats: Record<string, {
    count: number;
    avgDuration: number;
    successRate: number;
  }>;
}

interface ErrorStats {
  totalErrors: number;
  errorRate: number;
  errorsByOperation: Record<string, number>;
  recentErrors: Array<{
    operation: string;
    timestamp: string;
    details?: any;
  }>;
}

export default function PerformanceDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Запросы данных
  const { data: healthData, refetch: refetchHealth } = useQuery<{data: SystemHealth}>({
    queryKey: ['/api/admin/performance/health'],
    refetchInterval: autoRefresh ? 10000 : false, // Обновление каждые 10 секунд
  });

  const { data: performanceData, refetch: refetchPerformance } = useQuery<{data: PerformanceReport}>({
    queryKey: ['/api/admin/performance/report'],
    refetchInterval: autoRefresh ? 30000 : false, // Обновление каждые 30 секунд
  });

  const { data: errorData, refetch: refetchErrors } = useQuery<{data: ErrorStats}>({
    queryKey: ['/api/admin/performance/errors'],
    refetchInterval: autoRefresh ? 15000 : false, // Обновление каждые 15 секунд
  });

  const health = healthData?.data;
  const performance = performanceData?.data;
  const errors = errorData?.data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getLoadColor = (load: string) => {
    switch (load) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const refreshAll = () => {
    refetchHealth();
    refetchPerformance();
    refetchErrors();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-muted-foreground">Real-time system monitoring and performance analytics</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            Auto Refresh
          </Button>
          <Button onClick={refreshAll} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            {health?.databaseConnected ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(health?.status || 'unknown')}`}>
              {health?.status?.toUpperCase() || 'UNKNOWN'}
            </div>
            <p className="text-xs text-muted-foreground">
              Database: {health?.databaseConnected ? 'Connected' : 'Disconnected'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.activeUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Users with active deposits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.avgResponseTime || 0}ms</div>
            <p className="text-xs text-muted-foreground">
              Average response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Load</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`text-2xl font-bold`}>
                {health?.systemLoad?.toUpperCase() || 'UNKNOWN'}
              </div>
              <Badge variant="outline" className={getLoadColor(health?.systemLoad || '')}>
                {health?.systemLoad}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Overall system performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Success Rate</span>
                    <span className="text-sm">{performance?.successRate || 0}%</span>
                  </div>
                  <Progress value={performance?.successRate || 0} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Total Operations</span>
                    <span className="text-sm">{performance?.totalOperations || 0}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Average Duration</span>
                    <span className="text-sm">{performance?.avgDuration || 0}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slow Operations</CardTitle>
                <CardDescription>Operations taking longer than expected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {performance?.slowOperations?.slice(0, 5).map((op, index) => (
                    <div key={index} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <div className="text-sm font-medium">{op.operation}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(op.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <Badge variant={op.status === 'success' ? 'default' : 'destructive'}>
                        {op.duration}ms
                      </Badge>
                    </div>
                  )) || (
                    <p className="text-sm text-muted-foreground">No slow operations detected</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Statistics</CardTitle>
                <CardDescription>System error metrics and trends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Errors</span>
                  <Badge variant="destructive">{errors?.totalErrors || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Error Rate</span>
                  <Badge variant={errors?.errorRate && errors.errorRate > 5 ? "destructive" : "default"}>
                    {errors?.errorRate || 0}%
                  </Badge>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Error Rate</span>
                    <span className="text-sm">{errors?.errorRate || 0}%</span>
                  </div>
                  <Progress value={errors?.errorRate || 0} className="bg-red-100" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
                <CardDescription>Latest error occurrences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {errors?.recentErrors?.slice(0, 5).map((error, index) => (
                    <Alert key={index}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="text-sm">{error.operation}</AlertTitle>
                      <AlertDescription className="text-xs">
                        {new Date(error.timestamp).toLocaleString()}
                      </AlertDescription>
                    </Alert>
                  )) || (
                    <p className="text-sm text-muted-foreground">No recent errors</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operation Statistics</CardTitle>
              <CardDescription>Detailed breakdown of system operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performance?.operationStats && Object.entries(performance.operationStats).map(([operation, stats]) => (
                  <div key={operation} className="border rounded p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium">{operation}</h4>
                      <Badge>{stats.count} calls</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Avg Duration:</span>
                        <span className="ml-2 font-medium">{stats.avgDuration}ms</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Success Rate:</span>
                        <span className="ml-2 font-medium">{stats.successRate}%</span>
                      </div>
                    </div>
                    <Progress value={stats.successRate} className="mt-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Last Update Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Dashboard automatically updates every 10-30 seconds</span>
            </div>
            <div>
              Last updated: {health?.lastUpdate ? new Date(health.lastUpdate).toLocaleTimeString() : 'Never'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}