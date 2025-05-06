import { useEffect, useState } from 'react';
import { cognitoCheck } from '@/utils/check-cognito';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, Info } from 'lucide-react';

interface CheckResult {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

export default function CognitoConfig() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Function to check Cognito configuration
  const checkConfiguration = async () => {
    setChecking(true);
    setResult(null);
    
    try {
      const checkResult = await cognitoCheck.run();
      setResult(checkResult);
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error
      });
    } finally {
      setChecking(false);
    }
  };

  // Get configuration values
  const cognitoUserPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const cognitoClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const awsRegion = import.meta.env.VITE_DYNAMODB_REGION || import.meta.env.VITE_AWS_REGION || 'us-east-1';
  const isProduction = import.meta.env.PROD === true;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AWS Cognito Configuration</CardTitle>
        <CardDescription>
          Check the connection to your AWS Cognito User Pool
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">User Pool ID</p>
              <p className="text-sm text-muted-foreground">{cognitoUserPoolId || 'Not configured'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">AWS Region</p>
              <p className="text-sm text-muted-foreground">{awsRegion}</p>
            </div>
          </div>

          <Button 
            onClick={() => setShowConfig(!showConfig)} 
            variant="outline" 
            size="sm"
          >
            {showConfig ? 'Hide Details' : 'Show Details'}
          </Button>

          {showConfig && (
            <div className="border rounded-md p-4 mt-4 bg-muted/30">
              <h4 className="font-medium mb-2">Configuration Details</h4>
              <p className="text-sm mb-2">
                <strong>User Pool ID:</strong> {cognitoUserPoolId || 'Not set'}
              </p>
              <p className="text-sm mb-2">
                <strong>Client ID:</strong> {cognitoClientId || 'Not set'}
              </p>
              <p className="text-sm mb-2">
                <strong>User Pool ARN:</strong> arn:aws:cognito-idp:{awsRegion}:191124798140:userpool/{cognitoUserPoolId}
              </p>
              <p className="text-sm mb-2">
                <strong>User Pool Name:</strong> AuthenticationUserPool28698864-Ci4QL4VT4tzl
              </p>
              <p className="text-sm mb-2">
                <strong>Environment:</strong> {isProduction ? 'Production' : 'Development'}
              </p>
              <p className="text-sm">
                <strong>Credentials Source:</strong> {isProduction ? 'EC2 Instance IAM Role' : 'Environment Variables'}
              </p>
            </div>
          )}

          {result && (
            <Alert 
              className={result.success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}
            >
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertTitle>{result.success ? 'Success' : 'Error'}</AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
              {result.success && result.data && (
                <div className="mt-2 text-sm">
                  <p>Found {result.data.userCount} users in the User Pool</p>
                </div>
              )}
            </Alert>
          )}

          {!isProduction && !cognitoUserPoolId && (
            <Alert className="border-yellow-500 bg-yellow-50">
              <Info className="h-4 w-4 text-yellow-500" />
              <AlertTitle>Configuration Required</AlertTitle>
              <AlertDescription>
                Cognito User Pool ID is not configured. Please add VITE_COGNITO_USER_POOL_ID to your .env file.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={checkConfiguration} 
          disabled={checking}
        >
          {checking ? 'Checking...' : 'Check Configuration'}
        </Button>
      </CardFooter>
    </Card>
  );
} 