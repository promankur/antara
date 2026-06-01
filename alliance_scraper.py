#!/usr/bin/env python3
"""
Antara Alliance Program - Lead Generation & Geolocation Sourcing Engine
Sourced via OpenStreetMap Overpass API (Free, Public & No API Keys Required)

This script queries public directories for digital print shops, xerox facilities, 
stationery stores, and copyshops across key target areas in India.
It compiles them into a clean CSV lead spreadsheet (ProSpects.csv) 
saved directly inside your Antara folder, which can be opened instantly in Excel.
"""

import os
import sys
import json
import csv
import urllib.request
import urllib.parse
import time

CITIES = ["Jaipur", "New Delhi", "Mumbai", "Bengaluru", "Ahmedabad"]

def fetch_leads_for_city(city_name, business_tag="copyshop|stationery|printing|office_supplies"):
    print(f"\n⚡ Initiating query for digital print hubs in {city_name}...")
    
    # 1. Geocode the city via OpenStreetMap Nominatim
    encoded_city = urllib.parse.quote(f"{city_name}, India")
    geocode_url = f"https://nominatim.openstreetmap.org/search?q={encoded_city}&format=json&limit=1"
    
    headers = {
        'User-Agent': 'AntaraAllianceLeadGen/1.1 (contact@promankur.com)'
    }
    
    try:
        req = urllib.request.Request(geocode_url, headers=headers)
        with urllib.request.urlopen(req) as response:
            city_data = json.loads(response.read().decode())
            
        if not city_data:
            print(f"⚠️ Could not resolve geocoding coordinates for '{city_name}'. Skipping.")
            return []
            
        lat = float(city_data[0]['lat'])
        lon = float(city_data[0]['lon'])
        print(f"📍 Anchored Coordinates: Lat {lat:.4f}, Lng {lon:.4f}")
        
    except Exception as e:
        print(f"❌ Geocoding request failed: {e}")
        return []

    # 2. Query Overpass API with a 15km bounding box around the city coordinate center
    offset = 0.12  # approx 12-15km radius
    min_lat = lat - offset
    max_lat = lat + offset
    min_lon = lon - offset
    max_lon = lon + offset

    overpass_query = f"""
    [out:json][timeout:30];
    (
      node["shop"~"{business_tag}"]({min_lat},{min_lon},{max_lat},{max_lon});
      way["shop"~"{business_tag}"]({min_lat},{min_lon},{max_lat},{max_lon});
    );
    out body;
    """

    overpass_url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({'data': overpass_query}).encode('utf-8')
    
    try:
        req = urllib.request.Request(overpass_url, data=data, headers=headers)
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            
        elements = result.get('elements', [])
        print(f"✅ Sourced {len(elements)} potential digital printing and xerox nodes!")
        
        leads = []
        for el in elements:
            tags = el.get('tags', {})
            name = tags.get('name', '').strip()
            if not name or name.lower() in ["unnamed", "printing shop", "xerox shop", "stationery"]:
                # Provide a descriptive fallback using the shop tag if the name is generic/missing
                shop_type = tags.get('shop', 'printing').replace('_', ' ').title()
                name = f"Local {shop_type} (Osm Ref)"
                
            phone = tags.get('phone', tags.get('contact:phone', tags.get('mobile', 'Not Listed'))).strip()
            street = tags.get('addr:street', '').strip()
            suburb = tags.get('addr:suburb', tags.get('addr:neighbourhood', '')).strip()
            city = tags.get('addr:city', city_name).strip()
            
            # Formulate full readable address
            address_parts = [p for p in [street, suburb, city] if p]
            address = ", ".join(address_parts) if address_parts else "Physical verification pending standard regional lookup"
            
            website = tags.get('website', tags.get('contact:website', 'Not Listed')).strip()
            
            leads.append({
                'City': city_name,
                'Business Name': name,
                'Contact Phone': phone,
                'Physical Address': address,
                'Website / Social': website,
                'Alliance Status': 'Prospect (Phase 1 B2B)',
                'Latitude': el.get('lat', lat),
                'Longitude': el.get('lon', lon)
            })
            
        return leads

    except Exception as e:
        print(f"❌ Overpass query failed for {city_name}: {e}")
        return []

def main():
    print("=================================================================")
    print("🌟 ANTARA ALLIANCE PROGRAM: AUTOMATED LEAD SHEET COMPILER 🌟")
    print("=================================================================")
    
    target_file = "/Users/ankurm4/Documents/Antara/ProSpects.csv"
    
    # Remove existing prospects file to ensure fresh database generation
    if os.path.exists(target_file):
        try:
            os.remove(target_file)
        except Exception:
            pass
            
    all_leads = []
    for city in CITIES:
        leads = fetch_leads_for_city(city)
        all_leads.extend(leads)
        # Polite spacing delay between API requests to respect OpenStreetMap usage guidelines
        time.sleep(2.0)
        
    if not all_leads:
        print("\n❌ Sourcing complete. No leads found across requested regional areas.")
        return
        
    # Write directly to the Excel-compatible CSV file inside the Antara workspace
    keys = all_leads[0].keys()
    try:
        with open(target_file, 'w', newline='', encoding='utf-8-sig') as f:
            dict_writer = csv.DictWriter(f, fieldnames=keys)
            dict_writer.writeheader()
            dict_writer.writerows(all_leads)
            
        print(f"\n=================================================================")
        print(f"✨ SUCCESS: Sourced {len(all_leads)} business leads!")
        print(f"📁 Lead sheet saved to: [ProSpects.csv](file://{target_file})")
        print(f"💡 Double-click this file to open it directly in Microsoft Excel.")
        print("=================================================================")
        
    except Exception as e:
        print(f"\n❌ Error writing file to {target_file}: {e}")

if __name__ == "__main__":
    main()
