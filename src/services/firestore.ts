import type { Sale, ApiKeyStatus, AllMappingsState } from '@/lib/types';
import { mockSales, mockAppSettings } from '@/lib/mock-services';

const DEFAULT_USER_ID = 'default-user';

export async function loadSales(userId: string): Promise<Sale[]> {
    console.log(`Loading sales for user: ${userId}`);
    await new Promise(resolve => setTimeout(resolve, 400));
    return [...mockSales];
}

export async function saveSales(userId: string, sales: Sale[]): Promise<void> {
    console.log(`Saving ${sales.length} sales for user: ${userId}`);
    
    sales.forEach(newSale => {
        const index = mockSales.findIndex(existing => existing.id === newSale.id);
        if (index !== -1) {
            // Update existing sale
            mockSales[index] = { ...mockSales[index], ...newSale };
        } else {
            // Add new sale
            mockSales.push(newSale);
        }
    });

    await new Promise(resolve => setTimeout(resolve, 400));
}

type AppSettings = {
    iderisPrivateKey?: string;
    googleSheetsApiKey?: string;
    allMappings?: AllMappingsState;
    friendlyFieldNames?: Record<string, string>;
    fileNames?: { [key: string]: string };
    fileData?: { [key: string]: string };
    iderisApiStatus?: ApiKeyStatus;
    googleSheetsApiStatus?: ApiKeyStatus;
};

export const loadAppSettings = async (userId: string): Promise<AppSettings | null> => {
    console.log("Loading app settings for user:", userId);
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockAppSettings;
}

export const saveAppSettings = async (userId: string, settings: Partial<AppSettings>): Promise<void> => {
    console.log("Saving app settings for user:", userId, settings);
    await new Promise(resolve => setTimeout(resolve, 200));
    Object.assign(mockAppSettings, settings);
}
