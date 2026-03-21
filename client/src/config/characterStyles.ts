export interface StylePreset {
    id: string;
    name: string;
    gender: 'male' | 'female';
    skinColor: string;
    hairColor: string;
    outfitColor: string;
    previewEmoji: string;
    textureKey?: string;
}

export const MALE_STYLES: StylePreset[] = [
    { id: 'm1', name: 'Casual', gender: 'male', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👕', textureKey: 'charBase' },
    { id: 'm2', name: 'Stylish', gender: 'male', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '🎧', textureKey: 'char_m_casual' },
    { id: 'm3', name: 'Formal', gender: 'male', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👔', textureKey: 'char_m_suit' },
];

export const FEMALE_STYLES: StylePreset[] = [
    { id: 'f1', name: 'Casual', gender: 'female', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👖', textureKey: 'charBase_female' },
    { id: 'f2', name: 'Stylish', gender: 'female', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '🧥', textureKey: 'char_f_casual' },
    { id: 'f3', name: 'Formal', gender: 'female', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👗', textureKey: 'char_f_dress' },
];
