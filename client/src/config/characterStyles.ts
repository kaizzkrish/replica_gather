export interface StylePreset {
    id: string;
    name: string;
    gender: 'male' | 'female';
    skinColor: string;
    hairColor: string;
    outfitColor: string;
    previewEmoji: string;
    outfitKey?: string;
}

export const MALE_STYLES: StylePreset[] = [
    { id: 'm1', name: 'Casual', gender: 'male', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👕', outfitKey: '' },
    { id: 'm2', name: 'Stylish', gender: 'male', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '🎧', outfitKey: 'outfit_hoodie' },
    { id: 'm3', name: 'Formal', gender: 'male', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👔', outfitKey: 'outfit_suit' },
];

export const FEMALE_STYLES: StylePreset[] = [
    { id: 'f1', name: 'Casual', gender: 'female', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👖', outfitKey: '' },
    { id: 'f2', name: 'Stylish', gender: 'female', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '🧥', outfitKey: 'outfit_jacket' },
    { id: 'f3', name: 'Formal', gender: 'female', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👗', outfitKey: 'outfit_dress' },
];
