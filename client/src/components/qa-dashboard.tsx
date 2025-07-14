import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TestTube, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Play, 
  RefreshCw, 
  BarChart3, 
  Settings,
  FileText,
  Video,
  Image,
  Mic
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TestResult {
  testId: string;
  testName: string;
  passed: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
  details: any;
  timestamp: Date;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  successRate: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

interface ErrorStatistics {
  totalErrors: number;
  errorsByStage: Record<string, number>;
  errorsByService: Record<string, number>;
  recentErrors: Array<{
    message: string;
    stage?: string;
    timestamp: string;
  }>;
}

export default function QADashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("testing");
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testSummary, setTestSummary] = useState<TestSummary | null>(null);

  // Test execution mutation
  const runTestsMutation = useMutation({
    mutationFn: async (testSuite?: string) => {
      const response = await apiRequest("POST", "/api/tests/run", { testSuite });
      return response.json();
    },
    onSuccess: (data) => {
      setTestResults(data.results);
      setTestSummary(data.summary);
      toast({ 
        title: "Tests completed", 
        description: `${data.summary.passed}/${data.summary.total} tests passed` 
      });
    },
    onError: () => {
      toast({ title: "Test execution failed", variant: "destructive" });
    },
    onSettled: () => {
      setIsRunningTests(false);
    }
  });

  // Test statistics query
  const { data: testStats } = useQuery({
    queryKey: ['/api/tests/statistics'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tests/statistics");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Error statistics query
  const { data: errorStats } = useQuery({
    queryKey: ['/api/errors/statistics'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/errors/statistics");
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const handleRunTests = (testSuite?: string) => {
    setIsRunningTests(true);
    runTestsMutation.mutate(testSuite);
  };

  const getTestStatusIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getTestStatusBadge = (passed: boolean) => {
    return passed ? (
      <Badge className="bg-green-100 text-green-800">Passed</Badge>
    ) : (
      <Badge variant="destructive">Failed</Badge>
    );
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">QA Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor testing, validation, and error handling for video generation
          </p>
        </div>
        <Button
          onClick={() => handleRunTests()}
          disabled={isRunningTests}
          className="flex items-center gap-2"
        >
          {isRunningTests ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isRunningTests ? "Running Tests..." : "Run All Tests"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="errors">Error Monitoring</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="testing" className="space-y-6">
          {/* Test Summary */}
          {testSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Test Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{testSummary.total}</div>
                    <div className="text-sm text-muted-foreground">Total Tests</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{testSummary.passed}</div>
                    <div className="text-sm text-muted-foreground">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{testSummary.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{testSummary.successRate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </div>
                </div>
                <Progress 
                  value={testSummary.successRate} 
                  className="mt-4" 
                />
              </CardContent>
            </Card>
          )}

          {/* Test Results */}
          {testResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
                <CardDescription>
                  Detailed results from the latest test run
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {testResults.map((result) => (
                    <div key={result.testId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTestStatusIcon(result.passed)}
                          <span className="font-medium">{result.testName}</span>
                          {getTestStatusBadge(result.passed)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {result.duration}ms
                        </div>
                      </div>
                      
                      {result.errors.length > 0 && (
                        <div className="mt-2">
                          <div className="text-sm font-medium text-red-600 mb-1">Errors:</div>
                          <ul className="text-sm text-red-600 space-y-1">
                            {result.errors.map((error, index) => (
                              <li key={index}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {result.warnings.length > 0 && (
                        <div className="mt-2">
                          <div className="text-sm font-medium text-yellow-600 mb-1">Warnings:</div>
                          <ul className="text-sm text-yellow-600 space-y-1">
                            {result.warnings.map((warning, index) => (
                              <li key={index}>• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Test Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Test Actions</CardTitle>
              <CardDescription>
                Run specific test suites or individual tests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => handleRunTests("template_validation")}
                  disabled={isRunningTests}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Template Validation
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleRunTests("system_integration")}
                  disabled={isRunningTests}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  System Integration
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleRunTests("workflow_tests")}
                  disabled={isRunningTests}
                  className="flex items-center gap-2"
                >
                  <Video className="h-4 w-4" />
                  Workflow Tests
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleRunTests()}
                  disabled={isRunningTests}
                  className="flex items-center gap-2"
                >
                  <TestTube className="h-4 w-4" />
                  All Tests
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Validation</CardTitle>
              <CardDescription>
                Validate video templates for completeness and quality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Template validation ensures all required fields are present and content meets quality standards.
              </p>
              <div className="mt-4">
                <Button
                  onClick={() => handleRunTests("template_validation")}
                  disabled={isRunningTests}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Validate Templates
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-6">
          {/* Error Statistics */}
          {errorStats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Error Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{errorStats.totalErrors}</div>
                    <div className="text-sm text-muted-foreground">Total Errors</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{Object.keys(errorStats.errorsByStage).length}</div>
                    <div className="text-sm text-muted-foreground">Stages with Errors</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{errorStats.recentErrors.length}</div>
                    <div className="text-sm text-muted-foreground">Recent Errors</div>
                  </div>
                </div>

                {/* Errors by Stage */}
                {Object.keys(errorStats.errorsByStage).length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Errors by Stage</h4>
                    <div className="space-y-2">
                      {Object.entries(errorStats.errorsByStage).map(([stage, count]) => (
                        <div key={stage} className="flex justify-between items-center">
                          <span className="text-sm capitalize">{stage.replace(/_/g, ' ')}</span>
                          <Badge variant="destructive">{count as number}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Errors */}
                {errorStats.recentErrors.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Recent Errors</h4>
                    <div className="space-y-2">
                      {errorStats.recentErrors.slice(0, 5).map((error: any, index: number) => (
                        <div key={index} className="text-sm p-2 bg-red-50 rounded">
                          <div className="font-medium">{error.message}</div>
                          {error.stage && (
                            <div className="text-xs text-muted-foreground">
                              Stage: {error.stage}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="statistics" className="space-y-6">
          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {testStats?.successRate?.toFixed(1) || 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">Test Success Rate</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {testStats?.totalTests || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Tests</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Status */}
          <Card>
            <CardHeader>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>
                Current status of video generation services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>OpenAI Service</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    <span>Image Generation</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    <span>Audio Generation</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    <span>Video Rendering</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 