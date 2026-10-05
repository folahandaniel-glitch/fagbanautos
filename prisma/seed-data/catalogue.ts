// Division / category tree and demo product templates.

export interface CatNode { name: string; vat?: boolean; children?: string[] }
export interface DivisionSeed { slug: string; name: string; tagline: string; description: string; icon: string; accent: string; cats: CatNode[] }

export const DIVISIONS: DivisionSeed[] = [
  {
    slug: "autogallery", name: "FAGDAN AutoGallery", tagline: "Driven by Trust. Powered by Choice.", icon: "car", accent: "#0B3A8F",
    description: "Brand new, foreign used, Nigerian used and certified vehicles, with verified specifications and transparent pricing.",
    cats: [
      { name: "SUVs" }, { name: "Sedans" }, { name: "Coupes" }, { name: "Convertibles" }, { name: "Hatchbacks" }, { name: "Pickup Trucks" },
      { name: "Vans" }, { name: "Buses" }, { name: "Trucks" }, { name: "Electric Vehicles" }, { name: "Hybrid Vehicles" }, { name: "Luxury Vehicles" },
      { name: "Sports Cars" }, { name: "Commercial Vehicles" }, { name: "Armoured Vehicles" },
    ],
  },
  {
    slug: "auto-parts", name: "FAGDAN Auto Parts", tagline: "Genuine and aftermarket parts, matched to your car.", icon: "wrench", accent: "#0B3A8F",
    description: "OEM and aftermarket parts with make, model and year fitment.",
    cats: [
      { name: "Engine Parts", children: ["Pistons and Rings", "Gaskets", "Timing Belts and Chains", "Oil Pumps"] },
      { name: "Brake Parts", children: ["Brake Pads", "Brake Discs", "Brake Calipers", "Brake Fluid"] },
      { name: "Suspension Parts", children: ["Shock Absorbers", "Control Arms", "Bushings", "Ball Joints"] },
      { name: "Electrical Parts", children: ["Alternators", "Starters", "Sensors", "Ignition Coils"] },
      { name: "Filters", children: ["Oil Filters", "Air Filters", "Fuel Filters", "Cabin Filters"] },
      { name: "Batteries" }, { name: "Spark Plugs and Ignition" }, { name: "Cooling System", children: ["Radiators", "Water Pumps", "Thermostats"] },
      { name: "Air Conditioning Parts" }, { name: "Transmission Parts" }, { name: "Steering Components" }, { name: "Wheel Components" },
      { name: "Exhaust Components" }, { name: "Fuel System" }, { name: "Belts" },
      { name: "Lighting", children: ["Headlights", "Tail Lights", "Fog Lights"] },
      { name: "Body Parts", children: ["Bumpers", "Grilles", "Mirrors", "Body Panels"] }, { name: "Wipers" },
    ],
  },
  {
    slug: "auto-accessories", name: "FAGDAN Auto Accessories", tagline: "Beautify, protect and enhance your vehicle.", icon: "sparkles", accent: "#C9A227",
    description: "Seat covers, mats, chargers, cameras, detailing and everything that makes a car yours.",
    cats: [
      { name: "Seat Covers", children: ["Leather Seat Covers", "Fabric Seat Covers", "Custom Seat Covers", "Headrest Covers", "Seat Cushions"] },
      { name: "Steering Wheel Covers" }, { name: "Dashboard Covers and Mats" },
      { name: "Floor Mats and Carpets", children: ["Floor Mats", "Car Carpets", "Boot Mats"] },
      { name: "Sunshades and Window Accessories", children: ["Sunshades", "Rain Guards", "Window Tint"] },
      { name: "Phone Holders and Chargers", children: ["Phone Holders", "Wireless Phone Holders", "USB Chargers", "Car Chargers"] },
      { name: "Interior Lighting", children: ["LED Interior Lights", "Ambient Lighting"] },
      { name: "Organizers", children: ["Boot Organizers", "Car Organizers"] },
      { name: "Car Covers" }, { name: "Exterior Protection", children: ["Mud Flaps", "Door Edge Guards", "Body Mouldings", "Paint Protection Film"] },
      { name: "Air Fresheners" },
      { name: "Cleaning and Detailing", children: ["Cleaning Kits", "Car Polish", "Dashboard Polish", "Tyre Shine", "Microfiber Towels", "Vacuum Cleaners", "Pressure Washers", "Detailing Kits"] },
      { name: "Tyre Products" },
    ],
  },
  {
    slug: "auto-technology", name: "FAGDAN Auto Technology", tagline: "Smarter, safer, connected driving.", icon: "cpu", accent: "#0B3A8F",
    description: "Dashcams, GPS trackers, cameras, head units and vehicle security.",
    cats: [
      { name: "Dashcams" }, { name: "GPS Trackers" }, { name: "Reverse and Parking Cameras", children: ["Reverse Cameras", "Parking Sensors"] },
      { name: "Head Units and Screens" }, { name: "Audio", children: ["Speakers", "Amplifiers", "Subwoofers"] },
      { name: "Connectivity", children: ["Wireless CarPlay Devices", "Android Auto Devices", "Car Wi-Fi"] },
      { name: "Security Systems" }, { name: "Tyre Pressure Monitoring" },
    ],
  },
  {
    slug: "auto-care", name: "FAGDAN Auto Care", tagline: "Expert care for every kilometre.", icon: "gauge", accent: "#0B3A8F",
    description: "Inspection, maintenance, diagnostics, detailing and repair, booked online.",
    cats: [{ name: "Inspection" }, { name: "Maintenance" }, { name: "Diagnostics" }, { name: "Detailing" }, { name: "Repair" }],
  },
  { slug: "vehicle-finance", name: "FAGDAN Vehicle Finance", tagline: "Flexible ways to own your vehicle.", icon: "banknote", accent: "#C9A227", description: "Outright purchase, FAGDAN installment plans and finance applications.", cats: [] },
  { slug: "imports", name: "FAGDAN Imports", tagline: "We source it. We ship it. You drive it.", icon: "ship", accent: "#0B3A8F", description: "Vehicle sourcing and import from Japan, USA, Canada, Germany, Korea, China, UK and Europe.", cats: [] },
];

export interface ProductTemplate {
  division: string; category: string; name: string; brand: string; priceNaira: number; type: "PART" | "ACCESSORY" | "TECHNOLOGY";
  grade?: "OEM" | "AFTERMARKET"; compat?: { make: string; model?: string; from?: number; to?: number }[]; warranty?: string; features?: string[];
  stock?: number;
}

const camry = [{ make: "Toyota", model: "Camry", from: 2018, to: 2024 }];
const corolla = [{ make: "Toyota", model: "Corolla", from: 2016, to: 2023 }];
const rav4 = [{ make: "Toyota", model: "RAV4", from: 2017, to: 2024 }];
const accord = [{ make: "Honda", model: "Accord", from: 2016, to: 2022 }];
const universal: ProductTemplate["compat"] = [];

export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  // Seat covers
  { division: "auto-accessories", category: "Leather Seat Covers", name: "Premium Leather Seat Cover Set - Toyota Camry 2018-2024", brand: "AutoLux", priceNaira: 185_000, type: "ACCESSORY", compat: camry, warranty: "6 months", features: ["Full 5-seat set", "Perforated breathable leather", "Airbag-safe stitching"] },
  { division: "auto-accessories", category: "Leather Seat Covers", name: "Premium Leather Seat Cover Set - Toyota Corolla 2016-2023", brand: "AutoLux", priceNaira: 165_000, type: "ACCESSORY", compat: corolla, warranty: "6 months" },
  { division: "auto-accessories", category: "Leather Seat Covers", name: "Premium Leather Seat Cover Set - Toyota RAV4 2017-2024", brand: "AutoLux", priceNaira: 195_000, type: "ACCESSORY", compat: rav4, warranty: "6 months" },
  { division: "auto-accessories", category: "Leather Seat Covers", name: "Premium Leather Seat Cover Set - Honda Accord 2016-2022", brand: "AutoLux", priceNaira: 175_000, type: "ACCESSORY", compat: accord, warranty: "6 months" },
  { division: "auto-accessories", category: "Leather Seat Covers", name: "Universal Leather-Look Seat Cover Set (5 seats)", brand: "DriveStyle", priceNaira: 95_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Fabric Seat Covers", name: "Breathable Fabric Seat Cover Set - Toyota Camry", brand: "ComfortFit", priceNaira: 85_000, type: "ACCESSORY", compat: camry },
  { division: "auto-accessories", category: "Fabric Seat Covers", name: "Universal Fabric Seat Cover Set", brand: "ComfortFit", priceNaira: 55_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Custom Seat Covers", name: "Custom-Tailored Seat Covers (Made to Order)", brand: "FAGDAN Custom", priceNaira: 250_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Headrest Covers", name: "Headrest Cover Pair - Black Leather", brand: "DriveStyle", priceNaira: 12_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Seat Cushions", name: "Memory Foam Seat Cushion", brand: "ComfortFit", priceNaira: 22_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Seat Cushions", name: "Neck Pillow - Memory Foam", brand: "ComfortFit", priceNaira: 9_500, type: "ACCESSORY", compat: universal },
  // Steering / dash
  { division: "auto-accessories", category: "Steering Wheel Covers", name: "Leather Steering Wheel Cover - Toyota Camry", brand: "AutoLux", priceNaira: 14_500, type: "ACCESSORY", compat: camry },
  { division: "auto-accessories", category: "Steering Wheel Covers", name: "Universal Steering Wheel Cover 38cm", brand: "DriveStyle", priceNaira: 8_500, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Steering Wheel Covers", name: "Carbon-Look Steering Wheel Cover", brand: "DriveStyle", priceNaira: 11_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Dashboard Covers and Mats", name: "Dashboard Cover - Toyota Camry 2018-2024", brand: "AutoLux", priceNaira: 28_000, type: "ACCESSORY", compat: camry },
  { division: "auto-accessories", category: "Dashboard Covers and Mats", name: "Anti-Slip Dashboard Mat", brand: "DriveStyle", priceNaira: 6_500, type: "ACCESSORY", compat: universal },
  // Mats
  { division: "auto-accessories", category: "Floor Mats", name: "5D Floor Mat Set - Toyota Camry 2018-2024", brand: "AutoLux", priceNaira: 75_000, type: "ACCESSORY", compat: camry },
  { division: "auto-accessories", category: "Floor Mats", name: "5D Floor Mat Set - Toyota Corolla 2016-2023", brand: "AutoLux", priceNaira: 68_000, type: "ACCESSORY", compat: corolla },
  { division: "auto-accessories", category: "Floor Mats", name: "5D Floor Mat Set - Toyota RAV4 2017-2024", brand: "AutoLux", priceNaira: 82_000, type: "ACCESSORY", compat: rav4 },
  { division: "auto-accessories", category: "Floor Mats", name: "All-Weather Rubber Floor Mats (Universal)", brand: "TerraGuard", priceNaira: 32_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Car Carpets", name: "Full Car Carpet Set - Universal Sedan", brand: "TerraGuard", priceNaira: 60_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Boot Mats", name: "Boot Mat - Toyota Camry 2018-2024", brand: "AutoLux", priceNaira: 24_000, type: "ACCESSORY", compat: camry },
  { division: "auto-accessories", category: "Boot Mats", name: "Boot Mat - Honda Accord 2016-2022", brand: "AutoLux", priceNaira: 23_000, type: "ACCESSORY", compat: accord },
  { division: "auto-accessories", category: "Boot Mats", name: "Universal SUV Boot Liner", brand: "TerraGuard", priceNaira: 29_000, type: "ACCESSORY", compat: universal },
  // Sunshades etc.
  { division: "auto-accessories", category: "Sunshades", name: "Front Windscreen Sunshade - Foldable", brand: "ShadePro", priceNaira: 7_500, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Sunshades", name: "Custom-Fit Sunshade Set - Toyota Camry", brand: "ShadePro", priceNaira: 18_000, type: "ACCESSORY", compat: camry },
  { division: "auto-accessories", category: "Rain Guards", name: "Window Rain Guard Set (4 pcs)", brand: "ShadePro", priceNaira: 16_500, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Window Tint", name: "Ceramic Window Tint Film Roll 5m", brand: "ShadePro", priceNaira: 45_000, type: "ACCESSORY", compat: universal },
  // Phones & chargers
  { division: "auto-accessories", category: "Phone Holders", name: "Dashboard Phone Holder - Adjustable", brand: "ConnectGo", priceNaira: 6_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Wireless Phone Holders", name: "15W Wireless Charging Phone Holder", brand: "ConnectGo", priceNaira: 19_500, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Phone Holders", name: "Magnetic Air-Vent Phone Holder", brand: "ConnectGo", priceNaira: 5_500, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "USB Chargers", name: "Dual USB Fast Car Charger 48W", brand: "ConnectGo", priceNaira: 8_500, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Car Chargers", name: "USB-C PD 65W Car Charger", brand: "ConnectGo", priceNaira: 12_500, type: "ACCESSORY", compat: universal },
  // Lighting
  { division: "auto-accessories", category: "LED Interior Lights", name: "LED Interior Light Kit (6 pcs)", brand: "LumaDrive", priceNaira: 14_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Ambient Lighting", name: "64-Colour Ambient Lighting Kit", brand: "LumaDrive", priceNaira: 32_000, type: "ACCESSORY", compat: universal },
  // Organisers
  { division: "auto-accessories", category: "Boot Organizers", name: "Foldable Boot Organizer", brand: "TerraGuard", priceNaira: 13_500, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Car Organizers", name: "Back-Seat Organizer with Tablet Holder", brand: "TerraGuard", priceNaira: 11_500, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Car Covers", name: "Waterproof Car Cover - Sedan", brand: "ShadePro", priceNaira: 38_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Car Covers", name: "Waterproof Car Cover - SUV", brand: "ShadePro", priceNaira: 45_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Mud Flaps", name: "Mud Flap Set (4 pcs) - Universal", brand: "TerraGuard", priceNaira: 15_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Door Edge Guards", name: "Door Edge Guard Set", brand: "TerraGuard", priceNaira: 7_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Paint Protection Film", name: "Paint Protection Film (per metre)", brand: "ShieldCoat", priceNaira: 85_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Air Fresheners", name: "Premium Car Air Freshener - Oud", brand: "FreshRide", priceNaira: 4_500, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Air Fresheners", name: "Vent Clip Air Freshener - Fresh Linen", brand: "FreshRide", priceNaira: 3_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Air Fresheners", name: "Gel Air Freshener - Ocean", brand: "FreshRide", priceNaira: 2_500, type: "ACCESSORY", compat: universal },
  // Cleaning
  { division: "auto-accessories", category: "Cleaning Kits", name: "Complete Car Cleaning Kit (12 pcs)", brand: "CleanMax", priceNaira: 38_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Car Polish", name: "Carnauba Wax Polish 500ml", brand: "CleanMax", priceNaira: 12_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Dashboard Polish", name: "Dashboard Polish 450ml", brand: "CleanMax", priceNaira: 6_500, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Tyre Shine", name: "Tyre Shine Spray 500ml", brand: "CleanMax", priceNaira: 5_500, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Microfiber Towels", name: "Microfiber Towel Pack (10 pcs)", brand: "CleanMax", priceNaira: 9_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Vacuum Cleaners", name: "Portable Car Vacuum Cleaner 120W", brand: "CleanMax", priceNaira: 28_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Pressure Washers", name: "High-Pressure Car Washer 1800W", brand: "CleanMax", priceNaira: 95_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Detailing Kits", name: "Pro Detailing Kit (21 pcs)", brand: "CleanMax", priceNaira: 120_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Tyre Products", name: "Tyre Inflator Digital 12V", brand: "ConnectGo", priceNaira: 24_000, type: "ACCESSORY", compat: universal },
  { division: "auto-accessories", category: "Tyre Products", name: "Tyre Repair Kit", brand: "TerraGuard", priceNaira: 9_500, type: "ACCESSORY", compat: universal },
  // Technology
  { division: "auto-technology", category: "Dashcams", name: "4K Front and Rear Dashcam", brand: "VisionDrive", priceNaira: 85_000, type: "TECHNOLOGY", compat: universal, warranty: "12 months" },
  { division: "auto-technology", category: "Dashcams", name: "1080P Single-Lens Dashcam", brand: "VisionDrive", priceNaira: 38_000, type: "TECHNOLOGY", compat: universal, warranty: "12 months" },
  { division: "auto-technology", category: "GPS Trackers", name: "Real-Time GPS Vehicle Tracker", brand: "TrackSafe", priceNaira: 45_000, type: "TECHNOLOGY", compat: universal, warranty: "12 months" },
  { division: "auto-technology", category: "Reverse Cameras", name: "HD Reverse Camera Kit", brand: "VisionDrive", priceNaira: 28_000, type: "TECHNOLOGY", compat: universal },
  { division: "auto-technology", category: "Parking Sensors", name: "4-Sensor Parking Sensor Kit", brand: "VisionDrive", priceNaira: 22_000, type: "TECHNOLOGY", compat: universal },
  { division: "auto-technology", category: "Head Units and Screens", name: "10-inch Android Head Unit - Toyota Camry", brand: "SoundCore", priceNaira: 210_000, type: "TECHNOLOGY", compat: camry, warranty: "12 months" },
  { division: "auto-technology", category: "Speakers", name: "6.5-inch Component Speakers", brand: "SoundCore", priceNaira: 55_000, type: "TECHNOLOGY", compat: universal },
  { division: "auto-technology", category: "Amplifiers", name: "4-Channel Car Amplifier", brand: "SoundCore", priceNaira: 78_000, type: "TECHNOLOGY", compat: universal },
  { division: "auto-technology", category: "Subwoofers", name: "10-inch Active Subwoofer", brand: "SoundCore", priceNaira: 95_000, type: "TECHNOLOGY", compat: universal },
  { division: "auto-technology", category: "Wireless CarPlay Devices", name: "Wireless CarPlay Adapter", brand: "ConnectGo", priceNaira: 32_000, type: "TECHNOLOGY", compat: universal },
  { division: "auto-technology", category: "Android Auto Devices", name: "Wireless Android Auto Adapter", brand: "ConnectGo", priceNaira: 30_000, type: "TECHNOLOGY", compat: universal },
  { division: "auto-technology", category: "Car Wi-Fi", name: "4G Car Wi-Fi Hotspot", brand: "ConnectGo", priceNaira: 42_000, type: "TECHNOLOGY", compat: universal },
  { division: "auto-technology", category: "Security Systems", name: "Vehicle Alarm and Immobiliser System", brand: "TrackSafe", priceNaira: 65_000, type: "TECHNOLOGY", compat: universal },
  { division: "auto-technology", category: "Tyre Pressure Monitoring", name: "Wireless TPMS Kit", brand: "TrackSafe", priceNaira: 36_000, type: "TECHNOLOGY", compat: universal },
  // Parts
  { division: "auto-parts", category: "Brake Pads", name: "Front Brake Pad Set - Toyota Camry 2018-2024", brand: "Toyota Genuine", priceNaira: 38_000, type: "PART", grade: "OEM", compat: camry, warranty: "6 months", stock: 40 },
  { division: "auto-parts", category: "Brake Pads", name: "Front Brake Pad Set - Toyota Camry 2018-2024", brand: "Bosch", priceNaira: 24_000, type: "PART", grade: "AFTERMARKET", compat: camry, warranty: "6 months", stock: 60 },
  { division: "auto-parts", category: "Brake Pads", name: "Front Brake Pad Set - Toyota Corolla 2016-2023", brand: "Brembo", priceNaira: 29_000, type: "PART", grade: "AFTERMARKET", compat: corolla, stock: 50 },
  { division: "auto-parts", category: "Brake Pads", name: "Front Brake Pad Set - Honda Accord 2016-2022", brand: "Honda Genuine", priceNaira: 42_000, type: "PART", grade: "OEM", compat: accord, stock: 30 },
  { division: "auto-parts", category: "Brake Pads", name: "Rear Brake Pad Set - Toyota RAV4 2017-2024", brand: "Bosch", priceNaira: 22_000, type: "PART", grade: "AFTERMARKET", compat: rav4, stock: 35 },
  { division: "auto-parts", category: "Brake Discs", name: "Front Brake Disc Pair - Toyota Camry 2018-2024", brand: "Brembo", priceNaira: 68_000, type: "PART", grade: "AFTERMARKET", compat: camry, stock: 20 },
  { division: "auto-parts", category: "Oil Filters", name: "Oil Filter - Toyota Camry / Corolla / RAV4", brand: "Toyota Genuine", priceNaira: 6_500, type: "PART", grade: "OEM", compat: [...camry, ...corolla, ...rav4], stock: 200 },
  { division: "auto-parts", category: "Oil Filters", name: "Oil Filter - Honda Accord / Civic", brand: "Honda Genuine", priceNaira: 7_000, type: "PART", grade: "OEM", compat: accord, stock: 150 },
  { division: "auto-parts", category: "Air Filters", name: "Engine Air Filter - Toyota Camry 2018-2024", brand: "Bosch", priceNaira: 12_500, type: "PART", grade: "AFTERMARKET", compat: camry, stock: 80 },
  { division: "auto-parts", category: "Cabin Filters", name: "Cabin Air Filter - Toyota Camry 2018-2024", brand: "Bosch", priceNaira: 9_000, type: "PART", grade: "AFTERMARKET", compat: camry, stock: 90 },
  { division: "auto-parts", category: "Fuel Filters", name: "Fuel Filter - Toyota Hilux 2.8D", brand: "Denso", priceNaira: 18_500, type: "PART", grade: "OEM", compat: [{ make: "Toyota", model: "Hilux", from: 2016, to: 2024 }], stock: 40 },
  { division: "auto-parts", category: "Batteries", name: "12V 70Ah Maintenance-Free Car Battery", brand: "Exide", priceNaira: 95_000, type: "PART", grade: "AFTERMARKET", compat: universal, warranty: "12 months", stock: 25 },
  { division: "auto-parts", category: "Batteries", name: "12V 100Ah Heavy-Duty Battery (SUV/Truck)", brand: "Exide", priceNaira: 135_000, type: "PART", grade: "AFTERMARKET", compat: universal, warranty: "12 months", stock: 18 },
  { division: "auto-parts", category: "Alternators", name: "Alternator - Toyota Camry 2.5L", brand: "Denso", priceNaira: 185_000, type: "PART", grade: "OEM", compat: camry, stock: 10 },
  { division: "auto-parts", category: "Starters", name: "Starter Motor - Toyota Corolla 1.8L", brand: "Denso", priceNaira: 120_000, type: "PART", grade: "OEM", compat: corolla, stock: 12 },
  { division: "auto-parts", category: "Spark Plugs and Ignition", name: "Iridium Spark Plug Set (4) - Toyota 2.5L", brand: "NGK", priceNaira: 32_000, type: "PART", grade: "AFTERMARKET", compat: camry, stock: 70 },
  { division: "auto-parts", category: "Ignition Coils", name: "Ignition Coil - Toyota Camry 2.5L", brand: "Denso", priceNaira: 28_000, type: "PART", grade: "OEM", compat: camry, stock: 45 },
  { division: "auto-parts", category: "Radiators", name: "Radiator - Toyota Camry 2018-2024", brand: "Denso", priceNaira: 145_000, type: "PART", grade: "OEM", compat: camry, stock: 8 },
  { division: "auto-parts", category: "Water Pumps", name: "Water Pump - Honda Accord 2.4L", brand: "Aisin", priceNaira: 48_000, type: "PART", grade: "AFTERMARKET", compat: accord, stock: 14 },
  { division: "auto-parts", category: "Shock Absorbers", name: "Front Shock Absorber Pair - Toyota Camry", brand: "KYB", priceNaira: 98_000, type: "PART", grade: "AFTERMARKET", compat: camry, stock: 16 },
  { division: "auto-parts", category: "Control Arms", name: "Front Lower Control Arm - Toyota RAV4", brand: "TRW", priceNaira: 58_000, type: "PART", grade: "AFTERMARKET", compat: rav4, stock: 12 },
  { division: "auto-parts", category: "Ball Joints", name: "Ball Joint - Toyota Corolla", brand: "TRW", priceNaira: 15_500, type: "PART", grade: "AFTERMARKET", compat: corolla, stock: 40 },
  { division: "auto-parts", category: "Timing Belts and Chains", name: "Timing Belt Kit - Toyota Corolla 1.8L", brand: "Gates", priceNaira: 65_000, type: "PART", grade: "AFTERMARKET", compat: corolla, stock: 15 },
  { division: "auto-parts", category: "Belts", name: "Serpentine Belt - Toyota Camry 2.5L", brand: "Gates", priceNaira: 14_000, type: "PART", grade: "AFTERMARKET", compat: camry, stock: 30 },
  { division: "auto-parts", category: "Headlights", name: "Headlight Assembly Right - Toyota Camry 2018-2024", brand: "Depo", priceNaira: 175_000, type: "PART", grade: "AFTERMARKET", compat: camry, stock: 6 },
  { division: "auto-parts", category: "Tail Lights", name: "Tail Light Assembly Left - Toyota Corolla 2019-2023", brand: "Depo", priceNaira: 85_000, type: "PART", grade: "AFTERMARKET", compat: corolla, stock: 7 },
  { division: "auto-parts", category: "Fog Lights", name: "Fog Light Pair - Toyota RAV4", brand: "Depo", priceNaira: 45_000, type: "PART", grade: "AFTERMARKET", compat: rav4, stock: 9 },
  { division: "auto-parts", category: "Bumpers", name: "Front Bumper - Toyota Corolla 2019-2023", brand: "Depo", priceNaira: 120_000, type: "PART", grade: "AFTERMARKET", compat: corolla, stock: 4 },
  { division: "auto-parts", category: "Grilles", name: "Front Grille - Toyota Camry 2018-2024", brand: "Toyota Genuine", priceNaira: 95_000, type: "PART", grade: "OEM", compat: camry, stock: 5 },
  { division: "auto-parts", category: "Mirrors", name: "Side Mirror Right - Honda Accord 2016-2022", brand: "Honda Genuine", priceNaira: 78_000, type: "PART", grade: "OEM", compat: accord, stock: 6 },
  { division: "auto-parts", category: "Wipers", name: "Wiper Blade Set 24/18 - Universal", brand: "Bosch", priceNaira: 9_500, type: "PART", grade: "AFTERMARKET", compat: universal, stock: 100 },
  { division: "auto-parts", category: "Air Conditioning Parts", name: "AC Compressor - Toyota Camry 2.5L", brand: "Denso", priceNaira: 285_000, type: "PART", grade: "OEM", compat: camry, stock: 5 },
  { division: "auto-parts", category: "Transmission Parts", name: "Transmission Fluid ATF WS 4L", brand: "Toyota Genuine", priceNaira: 38_000, type: "PART", grade: "OEM", compat: [...camry, ...corolla, ...rav4], stock: 60 },
  { division: "auto-parts", category: "Steering Components", name: "Power Steering Rack - Toyota Camry", brand: "TRW", priceNaira: 240_000, type: "PART", grade: "AFTERMARKET", compat: camry, stock: 3 },
  { division: "auto-parts", category: "Wheel Components", name: "Wheel Bearing Hub Assembly - Toyota RAV4 Front", brand: "SKF", priceNaira: 68_000, type: "PART", grade: "AFTERMARKET", compat: rav4, stock: 11 },
  { division: "auto-parts", category: "Exhaust Components", name: "Catalytic Converter - Toyota Corolla 1.8L", brand: "Walker", priceNaira: 210_000, type: "PART", grade: "AFTERMARKET", compat: corolla, stock: 4 },
  { division: "auto-parts", category: "Fuel System", name: "Fuel Pump Assembly - Honda Accord 2.4L", brand: "Denso", priceNaira: 125_000, type: "PART", grade: "OEM", compat: accord, stock: 6 },
  { division: "auto-parts", category: "Sensors", name: "Oxygen Sensor - Toyota Camry 2.5L", brand: "Denso", priceNaira: 42_000, type: "PART", grade: "OEM", compat: camry, stock: 20 },
  { division: "auto-parts", category: "Sensors", name: "ABS Wheel Speed Sensor - Toyota Corolla", brand: "Denso", priceNaira: 26_000, type: "PART", grade: "OEM", compat: corolla, stock: 18 },
];

export interface ServiceSeed { slug: string; name: string; description: string; priceNaira: number; durationMin: number; category: string }
export const SERVICES: ServiceSeed[] = [
  { slug: "basic-inspection", name: "Basic Inspection", description: "A 30-point visual and functional check of your vehicle with a written summary.", priceNaira: 15_000, durationMin: 45, category: "Inspection" },
  { slug: "full-vehicle-inspection", name: "Full Vehicle Inspection", description: "A comprehensive 150-point inspection including road test, undercarriage and electronic scan, with a full report.", priceNaira: 45_000, durationMin: 120, category: "Inspection" },
  { slug: "pre-purchase-inspection", name: "Pre-Purchase Inspection", description: "Independent inspection before you buy any used car.", priceNaira: 60_000, durationMin: 120, category: "Inspection" },
  { slug: "routine-maintenance", name: "Routine Maintenance Service", description: "Manufacturer-schedule service: fluids, filters and safety checks.", priceNaira: 55_000, durationMin: 120, category: "Maintenance" },
  { slug: "oil-change", name: "Oil Change", description: "Engine oil and filter replacement with quality oil.", priceNaira: 25_000, durationMin: 45, category: "Maintenance" },
  { slug: "brake-inspection", name: "Brake Inspection", description: "Pads, discs, fluid and line inspection.", priceNaira: 10_000, durationMin: 45, category: "Inspection" },
  { slug: "brake-service", name: "Brake Service", description: "Brake pad replacement and brake system service (parts extra).", priceNaira: 30_000, durationMin: 90, category: "Repair" },
  { slug: "computer-diagnostics", name: "Computer Diagnostics", description: "Full OBD scan and fault-code analysis.", priceNaira: 20_000, durationMin: 60, category: "Diagnostics" },
  { slug: "ac-diagnosis", name: "AC Diagnosis", description: "Air-conditioning performance test and leak check.", priceNaira: 15_000, durationMin: 60, category: "Diagnostics" },
  { slug: "ac-repair", name: "Air Conditioning Repair", description: "AC gas refill, compressor and condenser repair (parts extra).", priceNaira: 40_000, durationMin: 120, category: "Repair" },
  { slug: "battery-service", name: "Battery Test and Service", description: "Battery health test, terminal cleaning and replacement.", priceNaira: 8_000, durationMin: 30, category: "Maintenance" },
  { slug: "wheel-alignment", name: "Wheel Alignment", description: "Computerised 4-wheel alignment.", priceNaira: 20_000, durationMin: 60, category: "Maintenance" },
  { slug: "wheel-balancing", name: "Wheel Balancing", description: "Computerised balancing for smooth driving.", priceNaira: 12_000, durationMin: 45, category: "Maintenance" },
  { slug: "tyre-service", name: "Tyre Fitting and Rotation", description: "Tyre fitting, rotation and pressure check.", priceNaira: 10_000, durationMin: 45, category: "Maintenance" },
  { slug: "suspension-inspection", name: "Suspension Inspection", description: "Shocks, arms, bushings and steering check.", priceNaira: 15_000, durationMin: 60, category: "Inspection" },
  { slug: "transmission-service", name: "Transmission Service", description: "Transmission fluid and filter service.", priceNaira: 65_000, durationMin: 120, category: "Maintenance" },
  { slug: "car-wash", name: "Premium Car Wash", description: "Hand wash, wheel clean and dry.", priceNaira: 8_000, durationMin: 45, category: "Detailing" },
  { slug: "interior-detailing", name: "Interior Detailing", description: "Deep clean of seats, carpets, dashboard and panels.", priceNaira: 45_000, durationMin: 180, category: "Detailing" },
  { slug: "exterior-detailing", name: "Exterior Detailing", description: "Clay bar, polish and wax for a showroom shine.", priceNaira: 55_000, durationMin: 180, category: "Detailing" },
  { slug: "full-car-detailing", name: "Full Car Detailing", description: "Complete interior and exterior detailing.", priceNaira: 95_000, durationMin: 360, category: "Detailing" },
  { slug: "ceramic-coating", name: "Ceramic Coating", description: "Multi-layer ceramic paint protection.", priceNaira: 250_000, durationMin: 480, category: "Detailing" },
  { slug: "window-tinting", name: "Window Tinting", description: "Premium heat-rejecting tint, installed by specialists.", priceNaira: 60_000, durationMin: 150, category: "Detailing" },
  { slug: "dent-repair", name: "Dent Repair", description: "Paintless and conventional dent repair.", priceNaira: 35_000, durationMin: 180, category: "Repair" },
  { slug: "body-repair", name: "Body Repair and Respray", description: "Panel repair and professional respray (quote after inspection).", priceNaira: 150_000, durationMin: 480, category: "Repair" },
  { slug: "roadside-assistance", name: "Roadside Assistance", description: "Jump-start, tyre change and on-site help (Lagos).", priceNaira: 20_000, durationMin: 60, category: "Repair" },
];

export const FIRST_NAMES = ["Adebayo", "Chinedu", "Ngozi", "Ibrahim", "Funmilayo", "Emeka", "Aisha", "Tunde", "Blessing", "Yusuf", "Kemi", "Obinna", "Halima", "Segun", "Amaka", "Musa", "Folake", "Ikenna", "Zainab", "Femi", "Chioma", "Bello", "Titi", "Uche", "Hauwa"];
export const LAST_NAMES = ["Adeyemi", "Okafor", "Bello", "Eze", "Balogun", "Nwosu", "Abubakar", "Ogunleye", "Okonkwo", "Lawal", "Adeleke", "Ibe", "Danjuma", "Ajayi", "Uchenna", "Salami", "Obi", "Garba"];
