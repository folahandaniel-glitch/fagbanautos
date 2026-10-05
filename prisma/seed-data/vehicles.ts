// Demo vehicle catalogue generator. Deterministic (seeded RNG) so every environment gets the same demo stock.
// All records are marked is_demo and carry generated placeholder imagery. VINs are fictitious ("DEMO" prefix).

export interface VehicleSeed {
  make: string; model: string; body: string; fuel: string; trans: string; drive: string; engine: string; hp: number;
  basePriceNaira: number; // brand-new reference price
  origin: string; // typical sourcing origin for used units
  makeCountry: string;
  years: number[];
}

const M = (
  make: string, makeCountry: string, model: string, body: string, fuel: string, engine: string, hp: number, basePriceNaira: number,
  origin: string, years: number[] = [2018, 2020, 2022], trans = "Automatic", drive = "FWD",
): VehicleSeed => ({ make, model, body, fuel, trans, drive, engine, hp, basePriceNaira, origin, makeCountry, years });

export const VEHICLE_SEEDS: VehicleSeed[] = [
  // Japanese
  M("Toyota", "Japan", "Camry", "Sedan", "Petrol", "2.5L 4-cyl", 203, 45_000_000, "USA", [2017, 2019, 2021, 2023]),
  M("Toyota", "Japan", "Corolla", "Sedan", "Petrol", "1.8L 4-cyl", 139, 32_000_000, "USA", [2016, 2019, 2022]),
  M("Toyota", "Japan", "RAV4", "SUV", "Petrol", "2.5L 4-cyl", 203, 60_000_000, "USA", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Toyota", "Japan", "Highlander", "SUV", "Petrol", "3.5L V6", 295, 78_000_000, "USA", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Toyota", "Japan", "Land Cruiser Prado", "SUV", "Petrol", "4.0L V6", 271, 98_000_000, "Japan", [2015, 2018, 2021], "Automatic", "4WD"),
  M("Toyota", "Japan", "Hilux", "Pickup", "Diesel", "2.8L Turbo Diesel", 201, 70_000_000, "Japan", [2018, 2021, 2024], "Automatic", "4WD"),
  M("Toyota", "Japan", "Sienna", "Van", "Petrol", "3.5L V6", 296, 55_000_000, "USA", [2015, 2018, 2021]),
  M("Toyota", "Japan", "Avalon", "Sedan", "Petrol", "3.5L V6", 301, 52_000_000, "USA", [2016, 2019]),
  M("Honda", "Japan", "Accord", "Sedan", "Petrol", "1.5L Turbo", 192, 42_000_000, "USA", [2016, 2018, 2020, 2022]),
  M("Honda", "Japan", "Civic", "Sedan", "Petrol", "2.0L 4-cyl", 158, 34_000_000, "Canada", [2016, 2019, 2022]),
  M("Honda", "Japan", "CR-V", "SUV", "Petrol", "1.5L Turbo", 190, 52_000_000, "Canada", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Honda", "Japan", "Pilot", "SUV", "Petrol", "3.5L V6", 280, 68_000_000, "USA", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Lexus", "Japan", "RX 350", "SUV", "Petrol", "3.5L V6", 295, 85_000_000, "USA", [2016, 2018, 2021, 2023], "Automatic", "AWD"),
  M("Lexus", "Japan", "ES 350", "Sedan", "Petrol", "3.5L V6", 302, 62_000_000, "USA", [2017, 2020, 2022]),
  M("Lexus", "Japan", "GX 460", "SUV", "Petrol", "4.6L V8", 301, 105_000_000, "USA", [2014, 2018, 2022], "Automatic", "4WD"),
  M("Lexus", "Japan", "LX 570", "SUV", "Petrol", "5.7L V8", 383, 180_000_000, "Japan", [2015, 2018, 2021], "Automatic", "4WD"),
  M("Nissan", "Japan", "Altima", "Sedan", "Petrol", "2.5L 4-cyl", 188, 33_000_000, "USA", [2016, 2019, 2022]),
  M("Nissan", "Japan", "Pathfinder", "SUV", "Petrol", "3.5L V6", 284, 55_000_000, "USA", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Nissan", "Japan", "Rogue", "SUV", "Petrol", "2.5L 4-cyl", 181, 40_000_000, "USA", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Mazda", "Japan", "CX-5", "SUV", "Petrol", "2.5L 4-cyl", 187, 45_000_000, "Japan", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Mitsubishi", "Japan", "Outlander", "SUV", "Petrol", "2.4L 4-cyl", 166, 38_000_000, "Japan", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Subaru", "Japan", "Forester", "SUV", "Petrol", "2.5L Boxer", 182, 44_000_000, "Japan", [2017, 2020, 2023], "Automatic", "AWD"),
  // Korean
  M("Hyundai", "South Korea", "Elantra", "Sedan", "Petrol", "2.0L 4-cyl", 147, 28_000_000, "Korea", [2016, 2019, 2022]),
  M("Hyundai", "South Korea", "Sonata", "Sedan", "Petrol", "2.5L 4-cyl", 191, 35_000_000, "Korea", [2017, 2020, 2023]),
  M("Hyundai", "South Korea", "Tucson", "SUV", "Petrol", "2.5L 4-cyl", 187, 42_000_000, "Korea", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Hyundai", "South Korea", "Santa Fe", "SUV", "Petrol", "2.5L Turbo", 277, 55_000_000, "Korea", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Kia", "South Korea", "Sportage", "SUV", "Petrol", "2.4L 4-cyl", 181, 40_000_000, "Korea", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Kia", "South Korea", "Sorento", "SUV", "Petrol", "3.5L V6", 290, 50_000_000, "Korea", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Kia", "South Korea", "Optima", "Sedan", "Petrol", "2.4L 4-cyl", 185, 30_000_000, "Korea", [2016, 2019]),
  M("Kia", "South Korea", "Rio", "Hatchback", "Petrol", "1.6L 4-cyl", 120, 22_000_000, "Korea", [2017, 2020, 2023]),
  // German
  M("Mercedes-Benz", "Germany", "C300", "Sedan", "Petrol", "2.0L Turbo", 255, 85_000_000, "Germany", [2016, 2018, 2021, 2023], "Automatic", "RWD"),
  M("Mercedes-Benz", "Germany", "E350", "Sedan", "Petrol", "3.5L V6", 302, 105_000_000, "Germany", [2015, 2018, 2021], "Automatic", "RWD"),
  M("Mercedes-Benz", "Germany", "GLE 350", "SUV", "Petrol", "3.5L V6", 302, 120_000_000, "Germany", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Mercedes-Benz", "Germany", "GLA 250", "SUV", "Petrol", "2.0L Turbo", 208, 65_000_000, "Germany", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Mercedes-Benz", "Germany", "G63 AMG", "SUV", "Petrol", "4.0L Twin-Turbo V8", 577, 380_000_000, "Germany", [2019, 2022], "Automatic", "4WD"),
  M("BMW", "Germany", "320i", "Sedan", "Petrol", "2.0L Turbo", 184, 70_000_000, "Germany", [2016, 2019, 2022], "Automatic", "RWD"),
  M("BMW", "Germany", "530i", "Sedan", "Petrol", "2.0L Turbo", 248, 100_000_000, "Germany", [2017, 2020, 2023], "Automatic", "RWD"),
  M("BMW", "Germany", "X5", "SUV", "Petrol", "3.0L Turbo", 335, 130_000_000, "Germany", [2016, 2019, 2022], "Automatic", "AWD"),
  M("BMW", "Germany", "X3", "SUV", "Petrol", "2.0L Turbo", 248, 85_000_000, "Germany", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Audi", "Germany", "A4", "Sedan", "Petrol", "2.0L Turbo", 188, 70_000_000, "Germany", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Audi", "Germany", "Q5", "SUV", "Petrol", "2.0L Turbo", 248, 90_000_000, "Germany", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Audi", "Germany", "Q7", "SUV", "Petrol", "3.0L Supercharged", 333, 125_000_000, "Germany", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Volkswagen", "Germany", "Passat", "Sedan", "Petrol", "2.0L Turbo", 174, 38_000_000, "Germany", [2016, 2019, 2022]),
  M("Volkswagen", "Germany", "Tiguan", "SUV", "Petrol", "2.0L Turbo", 184, 52_000_000, "Germany", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Porsche", "Germany", "Cayenne", "SUV", "Petrol", "3.0L Turbo V6", 335, 175_000_000, "Germany", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Porsche", "Germany", "Macan", "SUV", "Petrol", "2.0L Turbo", 248, 135_000_000, "Germany", [2017, 2020, 2023], "Automatic", "AWD"),
  // American
  M("Ford", "USA", "Explorer", "SUV", "Petrol", "3.5L V6", 290, 62_000_000, "USA", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Ford", "USA", "Edge", "SUV", "Petrol", "2.0L Turbo", 250, 48_000_000, "USA", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Ford", "USA", "Escape", "SUV", "Petrol", "1.5L Turbo", 179, 38_000_000, "USA", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Ford", "USA", "F-150", "Pickup", "Petrol", "3.5L EcoBoost V6", 375, 95_000_000, "USA", [2016, 2019, 2022], "Automatic", "4WD"),
  M("Ford", "USA", "Mustang", "Coupe", "Petrol", "5.0L V8", 450, 110_000_000, "USA", [2016, 2019, 2022], "Automatic", "RWD"),
  M("Chevrolet", "USA", "Camaro", "Coupe", "Petrol", "6.2L V8", 455, 105_000_000, "USA", [2016, 2019, 2022], "Automatic", "RWD"),
  M("Chevrolet", "USA", "Equinox", "SUV", "Petrol", "1.5L Turbo", 170, 40_000_000, "USA", [2018, 2020, 2023], "Automatic", "AWD"),
  M("Chevrolet", "USA", "Tahoe", "SUV", "Petrol", "5.3L V8", 355, 130_000_000, "USA", [2016, 2019, 2022], "Automatic", "4WD"),
  M("Jeep", "USA", "Wrangler", "SUV", "Petrol", "3.6L V6", 285, 90_000_000, "USA", [2016, 2019, 2022], "Automatic", "4WD"),
  M("Jeep", "USA", "Grand Cherokee", "SUV", "Petrol", "3.6L V6", 295, 85_000_000, "USA", [2016, 2019, 2022], "Automatic", "4WD"),
  M("Cadillac", "USA", "Escalade", "SUV", "Petrol", "6.2L V8", 420, 210_000_000, "USA", [2016, 2019, 2022], "Automatic", "4WD"),
  M("Dodge", "USA", "Charger", "Sedan", "Petrol", "3.6L V6", 292, 70_000_000, "USA", [2016, 2019, 2022], "Automatic", "RWD"),
  M("Tesla", "USA", "Model 3", "Sedan", "Electric", "Dual Motor", 480, 85_000_000, "USA", [2020, 2022, 2023], "Automatic", "AWD"),
  // Chinese
  M("Chery", "China", "Tiggo 7 Pro", "SUV", "Petrol", "1.5L Turbo", 156, 32_000_000, "China", [2022, 2023, 2024], "Automatic", "FWD"),
  M("Geely", "China", "Coolray", "SUV", "Petrol", "1.5L Turbo", 174, 30_000_000, "China", [2021, 2023, 2024]),
  M("BYD", "China", "Atto 3", "SUV", "Electric", "Single Motor", 204, 48_000_000, "China", [2023, 2024], "Automatic", "FWD"),
  M("BYD", "China", "Han", "Sedan", "Electric", "Dual Motor", 380, 85_000_000, "China", [2023, 2024], "Automatic", "AWD"),
  M("Haval", "China", "H6", "SUV", "Petrol", "2.0L Turbo", 201, 36_000_000, "China", [2021, 2023], "Automatic", "FWD"),
  M("GAC", "China", "GS4", "SUV", "Petrol", "1.5L Turbo", 169, 31_000_000, "China", [2021, 2023]),
  M("Changan", "China", "CS75 Plus", "SUV", "Petrol", "1.5L Turbo", 178, 33_000_000, "China", [2022, 2024]),
  // European
  M("Land Rover", "United Kingdom", "Range Rover Sport", "SUV", "Petrol", "3.0L Supercharged V6", 380, 160_000_000, "UK", [2016, 2019, 2022], "Automatic", "4WD"),
  M("Land Rover", "United Kingdom", "Range Rover Evoque", "SUV", "Petrol", "2.0L Turbo", 240, 90_000_000, "UK", [2016, 2019, 2022], "Automatic", "AWD"),
  M("Land Rover", "United Kingdom", "Discovery", "SUV", "Diesel", "3.0L Turbo Diesel", 258, 120_000_000, "UK", [2017, 2020, 2023], "Automatic", "4WD"),
  M("Peugeot", "France", "3008", "SUV", "Petrol", "1.6L Turbo", 165, 40_000_000, "France", [2018, 2021, 2023]),
  M("Volvo", "Sweden", "XC90", "SUV", "Petrol", "2.0L Turbo Hybrid", 316, 120_000_000, "Sweden", [2017, 2020, 2023], "Automatic", "AWD"),
  M("Volvo", "Sweden", "XC60", "SUV", "Petrol", "2.0L Turbo", 250, 85_000_000, "Sweden", [2017, 2020, 2023], "Automatic", "AWD"),
  M("MINI", "United Kingdom", "Cooper S", "Hatchback", "Petrol", "2.0L Turbo", 189, 55_000_000, "UK", [2016, 2019, 2022]),
  M("Jaguar", "United Kingdom", "F-Pace", "SUV", "Petrol", "2.0L Turbo", 247, 95_000_000, "UK", [2017, 2020, 2023], "Automatic", "AWD"),
  // Commercial and larger
  M("Toyota", "Japan", "HiAce Bus", "Bus", "Diesel", "2.8L Diesel", 174, 65_000_000, "Japan", [2018, 2021, 2023], "Manual", "RWD"),
  M("Ford", "USA", "Transit", "Van", "Diesel", "2.2L Diesel", 155, 58_000_000, "Europe", [2018, 2021, 2023], "Manual", "RWD"),
  M("Mercedes-Benz", "Germany", "Sprinter", "Van", "Diesel", "2.1L Diesel", 163, 90_000_000, "Germany", [2018, 2021, 2023], "Manual", "RWD"),
  M("MAN", "Germany", "TGS Truck", "Truck", "Diesel", "10.5L Diesel", 440, 140_000_000, "Germany", [2018, 2021], "Manual", "6x4"),
  M("Isuzu", "Japan", "NPR Truck", "Truck", "Diesel", "4.8L Diesel", 150, 45_000_000, "Japan", [2018, 2021, 2023], "Manual", "RWD"),
];

export const COLOURS = ["Black", "White", "Silver", "Grey", "Blue", "Red", "Pearl White", "Midnight Blue", "Champagne", "Dark Green", "Brown"];
export const NG_STATES = ["Lagos", "Abuja (FCT)", "Rivers", "Ogun", "Oyo", "Kano", "Anambra", "Delta", "Kaduna", "Enugu"];

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
export const pick = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];
