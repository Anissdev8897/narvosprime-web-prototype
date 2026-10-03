/**
 * 🎨 UTILITAIRE DE CONVERSION DE COULEURS DOFUS
 * Permet de convertir les entiers décimaux de Dofus en codes HEX/RGB pour Three.js.
 */

export const DofusColorUtils = {
    /**
     * Convertit un entier Dofus (ex: 16765564) en string HEX (ex: #FFA07A)
     */
    decimalToHex(decimal: number): string {
        if (decimal === -1) return '#ffffff';
        let hex = decimal.toString(16);
        while (hex.length < 6) hex = '0' + hex;
        return '#' + hex;
    },

    /**
     * Parse une liste de couleurs Dofus (format SQL: '16765564,7098157,...')
     * vers Narvos Prime CharacterCustomization colors.
     */
    parseBreedColors(colorString: string) {
        const parts = colorString.split(',').map(s => parseInt(s.trim()));
        return {
            skin: this.decimalToHex(parts[0] || -1),
            hair: this.decimalToHex(parts[1] || -1),
            base: this.decimalToHex(parts[2] || -1),
            secondary: this.decimalToHex(parts[3] || -1),
            detail: this.decimalToHex(parts[4] || -1)
        };
    }
};

export default DofusColorUtils;
