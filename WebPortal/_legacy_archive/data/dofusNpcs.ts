/**
 * 👤 PNJs (NPCs) DE DOFUS POUR NARVOS PRIME
 */

export interface DofusNpc {
    id: number;
    name: string;
    lookId: number;
    gender: 'MALE' | 'FEMALE';
    dialogIds: number[];
    isMerchant: boolean;
}

export const DOFUS_NPCS: DofusNpc[] = [
    { id: 1, name: "Recaudador", lookId: 8306, gender: 'MALE', dialogIds: [428977], isMerchant: false },
    { id: 23, name: "Carlota", lookId: 8653, gender: 'FEMALE', dialogIds: [144341], isMerchant: false },
    { id: 35, name: "Laura Soho", lookId: 8566, gender: 'FEMALE', dialogIds: [764016], isMerchant: true },
    { id: 38, name: "Rish Claymore", lookId: 8453, gender: 'MALE', dialogIds: [581067], isMerchant: false },
    { id: 53, name: "Farle Ingals", lookId: 8686, gender: 'MALE', dialogIds: [621842], isMerchant: true },
    { id: 100, name: "Banquier", lookId: 186619, gender: 'MALE', dialogIds: [189020], isMerchant: false }
];

export default DOFUS_NPCS;
