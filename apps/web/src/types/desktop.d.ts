import { BusinessSuiteDesktopBridge } from '@business-suite/shared';

declare global {
  interface Window {
    businessSuiteDesktop?: BusinessSuiteDesktopBridge;
  }
}

export {};
