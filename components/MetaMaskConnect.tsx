import { useWeb3 } from '../lib/web3Context';
import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function MetaMaskConnect() {
  const { account, isConnected, isConnecting, connectWallet, disconnectWallet, switchToGanache } = useWeb3();

  const handleConnectClick = async () => {
    await connectWallet();
    await switchToGanache();
  };

  if (isConnected && account) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-xs font-medium text-green-700 whitespace-nowrap">
            {account.slice(0, 6)}...{account.slice(-4)}
          </span>
        </div>
        <button
          onClick={disconnectWallet}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
          title="Disconnect wallet"
        >
          <LogOut className="w-4 h-4 text-red-600" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnectClick}
      disabled={isConnecting}
      className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-[#0A2342] rounded-lg hover:bg-[#C99E2E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
    >
      {isConnecting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </>
      )}
    </button>
  );
}
