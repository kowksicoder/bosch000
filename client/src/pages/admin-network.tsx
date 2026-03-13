
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Network, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AdminNetwork() {
  const { toast } = useToast();
  const [currentNetwork, setCurrentNetwork] = useState<'sepolia' | 'mainnet'>('sepolia');
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    // Load current network from localStorage
    const savedNetwork = localStorage.getItem('ADMIN_NETWORK_PREFERENCE') as 'sepolia' | 'mainnet' | null;
    if (savedNetwork) {
      setCurrentNetwork(savedNetwork);
    }
  }, []);

  const handleNetworkSwitch = async (network: 'sepolia' | 'mainnet') => {
    if (network === currentNetwork) return;

    setIsChanging(true);

    try {
      // Save network preference to localStorage
      localStorage.setItem('ADMIN_NETWORK_PREFERENCE', network);
      setCurrentNetwork(network);

      toast({
        title: "Network Switched",
        description: `Switched to Base ${network === 'sepolia' ? 'Sepolia (Testnet)' : 'Mainnet'}`,
      });

      // Reload page to apply network change
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: "Network Switch Failed",
        description: error instanceof Error ? error.message : "Failed to switch network",
        variant: "destructive",
      });
      setIsChanging(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">Network Settings</h2>
        <p className="text-muted-foreground">Switch between Base Sepolia (testnet) and Base Mainnet</p>
      </div>

      {/* Current Network Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="w-5 h-5" />
            Current Network
          </CardTitle>
          <CardDescription>Active blockchain network for coin creation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant={currentNetwork === 'sepolia' ? 'secondary' : 'default'} className="text-lg px-4 py-2">
              {currentNetwork === 'sepolia' ? 'Base Sepolia (Testnet)' : 'Base Mainnet'}
            </Badge>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
        </CardContent>
      </Card>

      {/* Warning Alert */}
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>
          Switching networks will affect all new coin deployments. Existing coins will remain on their original network.
          <br />
          <strong className="mt-2 block">Mainnet uses real ETH and incurs real costs!</strong>
        </AlertDescription>
      </Alert>

      {/* Network Options */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Base Sepolia */}
        <Card className={currentNetwork === 'sepolia' ? 'border-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Base Sepolia</span>
              {currentNetwork === 'sepolia' && (
                <Badge variant="default">Active</Badge>
              )}
            </CardTitle>
            <CardDescription>Testnet - Safe for testing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency:</span>
                <span className="font-medium">Test ETH (Free)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chain ID:</span>
                <span className="font-medium">84532</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost:</span>
                <span className="font-medium text-green-600">No real cost</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Backing:</span>
                <span className="font-medium">ETH only</span>
              </div>
            </div>
            <Button
              onClick={() => handleNetworkSwitch('sepolia')}
              disabled={currentNetwork === 'sepolia' || isChanging}
              variant={currentNetwork === 'sepolia' ? 'secondary' : 'outline'}
              className="w-full"
            >
              {currentNetwork === 'sepolia' ? 'Currently Active' : 'Switch to Sepolia'}
            </Button>
          </CardContent>
        </Card>

        {/* Base Mainnet */}
        <Card className={currentNetwork === 'mainnet' ? 'border-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Base Mainnet</span>
              {currentNetwork === 'mainnet' && (
                <Badge variant="default">Active</Badge>
              )}
            </CardTitle>
            <CardDescription>Production - Real money involved</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency:</span>
                <span className="font-medium">Real ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chain ID:</span>
                <span className="font-medium">8453</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost:</span>
                <span className="font-medium text-red-600">Real gas fees</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Backing:</span>
                <span className="font-medium">ETH, ZORA, or CREATOR_COIN</span>
              </div>
            </div>
            <Button
              onClick={() => handleNetworkSwitch('mainnet')}
              disabled={currentNetwork === 'mainnet' || isChanging}
              variant={currentNetwork === 'mainnet' ? 'secondary' : 'default'}
              className="w-full"
            >
              {currentNetwork === 'mainnet' ? 'Currently Active' : 'Switch to Mainnet'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Network Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Network Comparison</CardTitle>
          <CardDescription>Key differences between networks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Feature</th>
                  <th className="text-left py-2 px-4">Base Sepolia</th>
                  <th className="text-left py-2 px-4">Base Mainnet</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 px-4 text-muted-foreground">Purpose</td>
                  <td className="py-2 px-4">Testing & Development</td>
                  <td className="py-2 px-4">Production Trading</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-4 text-muted-foreground">ETH Value</td>
                  <td className="py-2 px-4">No real value</td>
                  <td className="py-2 px-4">Real monetary value</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-4 text-muted-foreground">Get Test ETH</td>
                  <td className="py-2 px-4">Free from faucets</td>
                  <td className="py-2 px-4">Must purchase</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-4 text-muted-foreground">Risk</td>
                  <td className="py-2 px-4 text-green-600">Zero financial risk</td>
                  <td className="py-2 px-4 text-red-600">Real financial risk</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-muted-foreground">Recommended For</td>
                  <td className="py-2 px-4">Development, Testing</td>
                  <td className="py-2 px-4">Production, Live Trading</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
