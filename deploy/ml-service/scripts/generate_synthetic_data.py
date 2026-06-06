#!/usr/bin/env python3
"""
Generate Synthetic Waste Management Data
Creates realistic training data for ML models
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os
import argparse

def generate_synthetic_waste_data(num_bins=50, num_days=90, readings_per_day=4):
    """
    Generate realistic synthetic waste management data

    Args:
        num_bins: Number of bins to simulate
        num_days: Number of days of data to generate
        readings_per_day: How many readings per day (4 = every 6 hours)

    Returns:
        DataFrame with synthetic waste data
    """

    print(f"\n{'='*60}")
    print(f"GENERATING SYNTHETIC WASTE DATA")
    print(f"{'='*60}")
    print(f"Bins: {num_bins}")
    print(f"Days: {num_days}")
    print(f"Readings per day: {readings_per_day}")
    print(f"{'='*60}\n")

    # Bin configuration
    bin_types = ['general', 'recyclable', 'organic', 'hazardous']
    bin_type_fill_rates = {
        'general': 2.5,      # % per hour
        'recyclable': 1.8,
        'organic': 3.2,
        'hazardous': 0.8
    }

    # Location (Sri Lanka - Colombo area)
    # You can change this to your city's coordinates
    base_lat = 6.9271
    base_lon = 79.8612

    data = []

    # Generate bins
    print("Creating bins...")
    bins = []
    for i in range(num_bins):
        bin_type = random.choice(bin_types)
        bins.append({
            'bin_id': f'BIN-{i+1:03d}',
            'bin_type': bin_type,
            'latitude': base_lat + random.uniform(-0.1, 0.1),
            'longitude': base_lon + random.uniform(-0.1, 0.1),
            'capacity': 100,
            'base_fill_rate': bin_type_fill_rates[bin_type]
        })
    print(f"✓ Created {len(bins)} bins")

    # Generate readings
    print("\nGenerating readings...")
    start_date = datetime.now() - timedelta(days=num_days)
    hours_between_readings = 24 // readings_per_day

    for bin_idx, bin in enumerate(bins):
        if (bin_idx + 1) % 10 == 0:
            print(f"  Processing bin {bin_idx + 1}/{num_bins}...")

        current_level = random.uniform(10, 30)  # Starting level
        current_date = start_date

        for day in range(num_days):
            for reading in range(readings_per_day):
                # Time features
                hour_of_day = current_date.hour
                day_of_week = current_date.weekday()
                month = current_date.month

                # Base fill rate
                base_rate = bin['base_fill_rate']

                # Adjust for time of day (more waste during day)
                if 6 <= hour_of_day <= 22:
                    time_factor = 1.5
                elif 22 <= hour_of_day or hour_of_day <= 6:
                    time_factor = 0.5
                else:
                    time_factor = 1.0

                # Adjust for day of week (more on weekdays)
                if day_of_week < 5:  # Monday-Friday
                    day_factor = 1.2
                else:
                    day_factor = 0.8

                # Seasonal variation
                if month in [12, 1, 2]:  # Holiday season
                    seasonal_factor = 1.3
                else:
                    seasonal_factor = 1.0

                # Weather simulation
                temperature = 25 + random.gauss(0, 5) + (month - 6) * 0.5  # Seasonal temp
                precipitation = max(0, random.gauss(0, 2))
                humidity = 70 + random.gauss(0, 10)

                # Weather effect on waste generation
                if temperature > 30:
                    weather_factor = 1.1
                elif temperature < 20:
                    weather_factor = 0.95
                else:
                    weather_factor = 1.0

                if precipitation > 5:
                    weather_factor *= 0.8

                # Calculate fill rate per hour
                fill_rate_per_hour = base_rate * time_factor * day_factor * seasonal_factor * weather_factor

                # Add noise
                fill_rate_per_hour += random.gauss(0, 0.5)

                # Update level (for hours since last reading)
                current_level += fill_rate_per_hour * hours_between_readings

                # Collection events (when > 85%, collected with 80% probability)
                if current_level >= 85 and random.random() < 0.8:
                    current_level = random.uniform(5, 15)  # Emptied

                # Occasional random collections
                if random.random() < 0.05:  # 5% chance
                    current_level = random.uniform(5, 15)

                # Cap at 100%
                current_level = min(100, max(0, current_level))

                # Record data
                data.append({
                    'bin_id': bin['bin_id'],
                    'timestamp': current_date,
                    'fill_level': round(current_level, 2),
                    'bin_type': bin['bin_type'],
                    'latitude': bin['latitude'],
                    'longitude': bin['longitude'],
                    'temperature': round(temperature, 2),
                    'precipitation': round(precipitation, 2),
                    'humidity': round(humidity, 2),
                    'hour': hour_of_day,
                    'day_of_week': day_of_week,
                    'month': month,
                    'is_weekend': int(day_of_week >= 5),
                    'is_business_hours': int(9 <= hour_of_day <= 17),
                    'capacity': bin['capacity']
                })

                # Move to next reading
                current_date += timedelta(hours=hours_between_readings)

    print(f"✓ Generated all readings")

    # Create DataFrame
    print("\nCreating DataFrame...")
    df = pd.DataFrame(data)

    # Sort by bin and time
    df = df.sort_values(['bin_id', 'timestamp'])

    # Add target variable (fill level N hours later)
    print("Adding target variables...")
    future_hours = [6, 12, 24, 48]
    for hours in future_hours:
        periods_ahead = hours // hours_between_readings
        df[f'fill_level_{hours}h_later'] = df.groupby('bin_id')['fill_level'].shift(-periods_ahead)

    # Remove rows without target (last N readings per bin)
    df_with_target = df.dropna(subset=['fill_level_24h_later'])

    print(f"\n{'='*60}")
    print(f"GENERATION COMPLETE")
    print(f"{'='*60}")
    print(f"Total records: {len(df_with_target):,}")
    print(f"Bins: {df_with_target['bin_id'].nunique()}")
    print(f"Date range: {df_with_target['timestamp'].min()} to {df_with_target['timestamp'].max()}")
    print(f"Days of data: {(df_with_target['timestamp'].max() - df_with_target['timestamp'].min()).days}")
    print(f"{'='*60}\n")

    # Display bin type distribution
    print("Bin Type Distribution:")
    print(df_with_target['bin_type'].value_counts().to_string())
    print()

    # Display sample statistics
    print("Fill Level Statistics:")
    print(df_with_target['fill_level'].describe().to_string())
    print()

    return df_with_target

def main():
    """Main function"""
    # Parse command-line arguments
    parser = argparse.ArgumentParser(
        description='Generate synthetic waste management data for ML training'
    )
    parser.add_argument(
        '--num_bins',
        type=int,
        default=50,
        help='Number of bins to simulate (default: 50)'
    )
    parser.add_argument(
        '--num_days',
        type=int,
        default=90,
        help='Number of days of data to generate (default: 90)'
    )
    parser.add_argument(
        '--readings_per_day',
        type=int,
        default=4,
        help='Readings per day, e.g., 4 = every 6 hours (default: 4)'
    )
    args = parser.parse_args()

    # Create output directory
    output_dir = 'data'
    os.makedirs(output_dir, exist_ok=True)

    # Generate data
    df = generate_synthetic_waste_data(
        num_bins=args.num_bins,
        num_days=args.num_days,
        readings_per_day=args.readings_per_day
    )

    # Save to CSV
    output_file = os.path.join(output_dir, 'synthetic_waste_data.csv')
    df.to_csv(output_file, index=False)
    print(f"✓ Saved to: {output_file}")

    # Display sample
    print("\nSample Data (first 10 rows):")
    print(df.head(10).to_string())

    print("\n" + "="*60)
    print("SUCCESS! Data ready for import.")
    print("="*60)
    print(f"\nNext steps:")
    print(f"1. Import to MongoDB: cd ../backend && npm run import:synthetic")
    print(f"2. Train ML model: npm run train:ml")
    print("="*60 + "\n")

if __name__ == '__main__':
    main()






















