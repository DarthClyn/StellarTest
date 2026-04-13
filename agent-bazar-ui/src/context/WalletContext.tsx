import React, { createContext, useContext, useState, useEffect } from 'react';
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { SwkAppDarkTheme, KitEventType } from "@creit-tech/stellar-wallets-kit/types";
import { defaultModules } from '@creit-tech/stellar-wallets-kit/modules/utils';

interface WalletContextType {
  address: string;
  setAddress: (addr: string) => void;
  kit: typeof StellarWalletsKit | null;
}

const WalletContext = createContext<WalletContextType>({
  address: '',
  setAddress: () => {},
  kit: null
});

export const useWallet = () => useContext(WalletContext);

// Initialize the kit once inside a browser environment
if (typeof window !== 'undefined') {
  StellarWalletsKit.init({
    theme: SwkAppDarkTheme,
    modules: defaultModules(),
  });
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState('');

  useEffect(() => {
    const sub1 = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event: any) => {
      console.log('Wallet state updated - FULL EVENT:', event);
      const addr = event.payload?.address || event.address;
      if (addr) {
        setAddress(addr);
      }
    });

    const sub2 = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
      setAddress('');
    });

    // Handle initial state if already connected
    StellarWalletsKit.getAddress().then(({ address }) => {
      if (address) setAddress(address);
    }).catch(() => {});

    return () => {
      sub1();
      sub2();
    };
  }, []);

  return (
    <WalletContext.Provider value={{ address, setAddress, kit: StellarWalletsKit }}>
      {children}
    </WalletContext.Provider>
  );
};
