/// Cities for manual location entry (a first-class alternative to GPS). The
/// list favours places with large Shia communities and the diaspora; any
/// other place can be entered by coordinates.
class City {
  const City(this.nameAr, this.nameEn, this.country, this.lat, this.lng, this.timezone);

  final String nameAr;
  final String nameEn;
  final String country;
  final double lat;
  final double lng;

  /// IANA zone, for daylight saving on any date.
  final String timezone;
}

const cities = <City>[
  // Lebanon
  City('بيروت', 'Beirut', 'لبنان', 33.8938, 35.5018, 'Asia/Beirut'),
  City('صور', 'Tyre', 'لبنان', 33.2705, 35.2038, 'Asia/Beirut'),
  City('صيدا', 'Sidon', 'لبنان', 33.5571, 35.3729, 'Asia/Beirut'),
  City('النبطية', 'Nabatieh', 'لبنان', 33.3772, 35.4836, 'Asia/Beirut'),
  City('بعلبك', 'Baalbek', 'لبنان', 34.0047, 36.2110, 'Asia/Beirut'),
  City('طرابلس', 'Tripoli', 'لبنان', 34.4367, 35.8497, 'Asia/Beirut'),
  // Iraq
  City('النجف', 'Najaf', 'العراق', 32.0000, 44.3350, 'Asia/Baghdad'),
  City('كربلاء', 'Karbala', 'العراق', 32.6160, 44.0249, 'Asia/Baghdad'),
  City('بغداد', 'Baghdad', 'العراق', 33.3152, 44.3661, 'Asia/Baghdad'),
  City('الكاظمية', 'Kadhimiya', 'العراق', 33.3800, 44.3400, 'Asia/Baghdad'),
  City('سامراء', 'Samarra', 'العراق', 34.1983, 43.8742, 'Asia/Baghdad'),
  City('البصرة', 'Basra', 'العراق', 30.5085, 47.7804, 'Asia/Baghdad'),
  City('الكوفة', 'Kufa', 'العراق', 32.0300, 44.4000, 'Asia/Baghdad'),
  City('الحلة', 'Hillah', 'العراق', 32.4637, 44.4199, 'Asia/Baghdad'),
  City('الناصرية', 'Nasiriyah', 'العراق', 31.0439, 46.2594, 'Asia/Baghdad'),
  City('العمارة', 'Amarah', 'العراق', 31.8356, 47.1440, 'Asia/Baghdad'),
  // Iran
  City('طهران', 'Tehran', 'إيران', 35.6892, 51.3890, 'Asia/Tehran'),
  City('قم', 'Qom', 'إيران', 34.6401, 50.8764, 'Asia/Tehran'),
  City('مشهد', 'Mashhad', 'إيران', 36.2605, 59.6168, 'Asia/Tehran'),
  City('أصفهان', 'Isfahan', 'إيران', 32.6546, 51.6680, 'Asia/Tehran'),
  City('شيراز', 'Shiraz', 'إيران', 29.5918, 52.5837, 'Asia/Tehran'),
  City('تبريز', 'Tabriz', 'إيران', 38.0800, 46.2919, 'Asia/Tehran'),
  City('الأهواز', 'Ahvaz', 'إيران', 31.3183, 48.6706, 'Asia/Tehran'),
  // Gulf
  City('الكويت', 'Kuwait City', 'الكويت', 29.3759, 47.9774, 'Asia/Kuwait'),
  City('المنامة', 'Manama', 'البحرين', 26.2285, 50.5860, 'Asia/Bahrain'),
  City('القطيف', 'Qatif', 'السعودية', 26.5196, 50.0115, 'Asia/Riyadh'),
  City('الأحساء', 'Al-Ahsa', 'السعودية', 25.3833, 49.5833, 'Asia/Riyadh'),
  City('المدينة المنورة', 'Medina', 'السعودية', 24.4672, 39.6112, 'Asia/Riyadh'),
  City('مكة المكرمة', 'Mecca', 'السعودية', 21.4225, 39.8262, 'Asia/Riyadh'),
  City('الرياض', 'Riyadh', 'السعودية', 24.7136, 46.6753, 'Asia/Riyadh'),
  City('الدوحة', 'Doha', 'قطر', 25.2854, 51.5310, 'Asia/Qatar'),
  City('دبي', 'Dubai', 'الإمارات', 25.2048, 55.2708, 'Asia/Dubai'),
  City('أبوظبي', 'Abu Dhabi', 'الإمارات', 24.4539, 54.3773, 'Asia/Dubai'),
  City('مسقط', 'Muscat', 'عُمان', 23.5880, 58.3829, 'Asia/Muscat'),
  // Levant, Egypt, Turkey, Caucasus
  City('دمشق', 'Damascus', 'سوريا', 33.5138, 36.2765, 'Asia/Damascus'),
  City('حلب', 'Aleppo', 'سوريا', 36.2021, 37.1343, 'Asia/Damascus'),
  City('عمّان', 'Amman', 'الأردن', 31.9454, 35.9284, 'Asia/Amman'),
  City('القدس', 'Jerusalem', 'فلسطين', 31.7683, 35.2137, 'Asia/Jerusalem'),
  City('القاهرة', 'Cairo', 'مصر', 30.0444, 31.2357, 'Africa/Cairo'),
  City('إسطنبول', 'Istanbul', 'تركيا', 41.0082, 28.9784, 'Europe/Istanbul'),
  City('باكو', 'Baku', 'أذربيجان', 40.4093, 49.8671, 'Asia/Baku'),
  // South Asia
  City('كراتشي', 'Karachi', 'باكستان', 24.8607, 67.0011, 'Asia/Karachi'),
  City('لاهور', 'Lahore', 'باكستان', 31.5204, 74.3587, 'Asia/Karachi'),
  City('إسلام آباد', 'Islamabad', 'باكستان', 33.6844, 73.0479, 'Asia/Karachi'),
  City('كابل', 'Kabul', 'أفغانستان', 34.5553, 69.2075, 'Asia/Kabul'),
  City('هرات', 'Herat', 'أفغانستان', 34.3529, 62.2040, 'Asia/Kabul'),
  City('لكناو', 'Lucknow', 'الهند', 26.8467, 80.9462, 'Asia/Kolkata'),
  City('مومباي', 'Mumbai', 'الهند', 19.0760, 72.8777, 'Asia/Kolkata'),
  City('حيدر آباد', 'Hyderabad', 'الهند', 17.3850, 78.4867, 'Asia/Kolkata'),
  City('دلهي', 'Delhi', 'الهند', 28.6139, 77.2090, 'Asia/Kolkata'),
  // Africa
  City('لاغوس', 'Lagos', 'نيجيريا', 6.5244, 3.3792, 'Africa/Lagos'),
  City('أبيدجان', 'Abidjan', 'ساحل العاج', 5.3600, -4.0083, 'Africa/Abidjan'),
  City('داكار', 'Dakar', 'السنغال', 14.7167, -17.4677, 'Africa/Dakar'),
  City('دار السلام', 'Dar es Salaam', 'تنزانيا', -6.7924, 39.2083, 'Africa/Dar_es_Salaam'),
  City('نيروبي', 'Nairobi', 'كينيا', -1.2921, 36.8219, 'Africa/Nairobi'),
  City('جوهانسبرغ', 'Johannesburg', 'جنوب أفريقيا', -26.2041, 28.0473, 'Africa/Johannesburg'),
  // Europe
  City('لندن', 'London', 'المملكة المتحدة', 51.5074, -0.1278, 'Europe/London'),
  City('مانشستر', 'Manchester', 'المملكة المتحدة', 53.4808, -2.2426, 'Europe/London'),
  City('برمنغهام', 'Birmingham', 'المملكة المتحدة', 52.4862, -1.8904, 'Europe/London'),
  City('باريس', 'Paris', 'فرنسا', 48.8566, 2.3522, 'Europe/Paris'),
  City('برلين', 'Berlin', 'ألمانيا', 52.5200, 13.4050, 'Europe/Berlin'),
  City('هامبورغ', 'Hamburg', 'ألمانيا', 53.5511, 9.9937, 'Europe/Berlin'),
  City('بروكسل', 'Brussels', 'بلجيكا', 50.8503, 4.3517, 'Europe/Brussels'),
  City('أمستردام', 'Amsterdam', 'هولندا', 52.3676, 4.9041, 'Europe/Amsterdam'),
  City('ستوكهولم', 'Stockholm', 'السويد', 59.3293, 18.0686, 'Europe/Stockholm'),
  City('مالمو', 'Malmö', 'السويد', 55.6050, 13.0038, 'Europe/Stockholm'),
  City('كوبنهاغن', 'Copenhagen', 'الدنمارك', 55.6761, 12.5683, 'Europe/Copenhagen'),
  City('أوسلو', 'Oslo', 'النرويج', 59.9139, 10.7522, 'Europe/Oslo'),
  City('هلسنكي', 'Helsinki', 'فنلندا', 60.1699, 24.9384, 'Europe/Helsinki'),
  City('فيينا', 'Vienna', 'النمسا', 48.2082, 16.3738, 'Europe/Vienna'),
  City('مدريد', 'Madrid', 'إسبانيا', 40.4168, -3.7038, 'Europe/Madrid'),
  City('روما', 'Rome', 'إيطاليا', 41.9028, 12.4964, 'Europe/Rome'),
  City('أثينا', 'Athens', 'اليونان', 37.9838, 23.7275, 'Europe/Athens'),
  // Americas
  City('ديربورن', 'Dearborn', 'الولايات المتحدة', 42.3223, -83.1763, 'America/Detroit'),
  City('نيويورك', 'New York', 'الولايات المتحدة', 40.7128, -74.0060, 'America/New_York'),
  City('واشنطن', 'Washington', 'الولايات المتحدة', 38.9072, -77.0369, 'America/New_York'),
  City('شيكاغو', 'Chicago', 'الولايات المتحدة', 41.8781, -87.6298, 'America/Chicago'),
  City('هيوستن', 'Houston', 'الولايات المتحدة', 29.7604, -95.3698, 'America/Chicago'),
  City('لوس أنجلوس', 'Los Angeles', 'الولايات المتحدة', 34.0522, -118.2437, 'America/Los_Angeles'),
  City('تورونتو', 'Toronto', 'كندا', 43.6532, -79.3832, 'America/Toronto'),
  City('مونتريال', 'Montreal', 'كندا', 45.5017, -73.5673, 'America/Toronto'),
  City('فانكوفر', 'Vancouver', 'كندا', 49.2827, -123.1207, 'America/Vancouver'),
  City('إدمونتون', 'Edmonton', 'كندا', 53.5461, -113.4938, 'America/Edmonton'),
  City('ساو باولو', 'São Paulo', 'البرازيل', -23.5505, -46.6333, 'America/Sao_Paulo'),
  City('بوينس آيرس', 'Buenos Aires', 'الأرجنتين', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'),
  // Asia-Pacific
  City('سيدني', 'Sydney', 'أستراليا', -33.8688, 151.2093, 'Australia/Sydney'),
  City('ملبورن', 'Melbourne', 'أستراليا', -37.8136, 144.9631, 'Australia/Melbourne'),
  City('كوالالمبور', 'Kuala Lumpur', 'ماليزيا', 3.1390, 101.6869, 'Asia/Kuala_Lumpur'),
  City('جاكرتا', 'Jakarta', 'إندونيسيا', -6.2088, 106.8456, 'Asia/Jakarta'),
];
