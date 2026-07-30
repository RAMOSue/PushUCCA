export type AnnouncementItem = {
  id: string;
  title: string;
  description: string;
  postedBy: string;
  postedAt: string;
  image?: string;
  priority?: "High" | "Normal";
};

export type DivisionProfile = {
  id: string;
  name: string;
  description: string;
  mission: string;
  vision: string;
  adviser: string;
  officers: string[];
  members: string[];
  gallery: string[];
};

export type CulturalItem = {
  id: string;
  name: string;
  tribe: string;
  description: string;
  origin: string;
  extra: string;
  image: string;
};

export type CostumeItem = {
  id: string;
  name: string;
  tribe: string;
  meaning: string;
  usage: string;
  significance: string;
  image: string;
};

export const announcements: AnnouncementItem[] = [
  {
    id: "1",
    title: "Practice tonight at 6:00 PM",
    description: "Please arrive early for warm-ups and final rehearsal preparations.",
    postedBy: "UCCA Office",
    postedAt: "Today • 9:00 AM",
    image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=80",
    priority: "High",
  },
  {
    id: "2",
    title: "Costume fitting tomorrow",
    description: "Bring your preferred size and any costume concerns for fitting review.",
    postedBy: "Costume Committee",
    postedAt: "Yesterday • 4:30 PM",
    image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "3",
    title: "New performance assigned",
    description: "A new cultural performance schedule has been released for the week.",
    postedBy: "Program Team",
    postedAt: "Jul 28 • 6:15 PM",
  },
];

export const divisions: DivisionProfile[] = [
  {
    id: "dulimbay",
    name: "Dulimbay",
    description: "A division focused on preserving heritage through performances and community storytelling.",
    mission: "To nurture cultural pride through disciplined practice and public performance.",
    vision: "To become a beacon of culture and tradition for the community.",
    adviser: "Ms. Lorna De Leon",
    officers: ["Chairperson: Jessa Rivera", "Secretary: Mark Santos"],
    members: ["Ariel Cruz", "Shaira Cordero", "Noel Belen"],
    gallery: [
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    id: "budjong",
    name: "Budjong",
    description: "The Budjong division brings together movement, rhythm, and traditional artistic expression.",
    mission: "To keep the art form alive through mentoring, practice, and collaborative learning.",
    vision: "To showcase traditional culture with confidence and excellence.",
    adviser: "Mr. Rey Mendez",
    officers: ["Chairperson: Carlo Delos Reyes", "Treasurer: Nica Flores"],
    members: ["Kaye Lim", "Ramil Dizon", "Tina Erazo"],
    gallery: [
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    id: "kayam",
    name: "Kayam",
    description: "Kayam focuses on preserving tradition through costume, instrument, and ceremonial heritage.",
    mission: "To educate members on the significance of cultural materials and performance traditions.",
    vision: "To become a trusted guardian of indigenous knowledge and practice.",
    adviser: "Ms. Claire Panganiban",
    officers: ["Chairperson: Mika Solis", "Coordinator: Paolo Villanueva"],
    members: ["Rhea Dela Cruz", "Jonas Beltran", "Aiza Magno"],
    gallery: [
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80",
    ],
  },
];

export const instruments: CulturalItem[] = [
  {
    id: "kulintang",
    name: "Kulintang",
    tribe: "Maguindanao",
    description: "A row of gongs played in rhythm for ceremonial and festive events.",
    origin: "Mindanao",
    extra: "Played by striking the gongs with padded mallets in coordinated patterns.",
    image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "bamboo-flute",
    name: "Bamboo Flute",
    tribe: "Various Indigenous Groups",
    description: "A simple instrument crafted from bamboo, commonly used in traditional performance.",
    origin: "Philippines",
    extra: "Played by blowing across or through finger holes to create melodic tones.",
    image: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=80",
  },
];

export const costumes: CostumeItem[] = [
  {
    id: "baro",
    name: "Traditional Baro",
    tribe: "Various Indigenous Groups",
    meaning: "Represents dignity, identity, and community pride.",
    usage: "Worn during performances, festivals, and cultural presentations.",
    significance: "Reflects the living heritage and customary beauty of the community.",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "headdress",
    name: "Ceremonial Headdress",
    tribe: "Cordillera",
    meaning: "Symbolizes leadership, honor, and ancestral connection.",
    usage: "Used in rituals, special gatherings, and formal ceremonies.",
    significance: "Carries spiritual importance and expresses communal role.",
    image: "https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=800&q=80",
  },
];
