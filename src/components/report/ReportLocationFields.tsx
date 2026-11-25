/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Campus location selector (including custom place field), date, and spot details.
 */

import React from 'react';
import { ItemType } from '../../types/index.ts';
import {
  isListedLocation,
  MAX_CUSTOM_LOCATION_LENGTH,
  NILE_LOCATION_GROUPS,
  OTHER_LOCATION_LABEL,
  OTHER_LOCATION_VALUE,
} from '../../config/locations.ts';

interface ReportLocationFieldsProps {
  reportType: ItemType;
  location: string;
  locationIsOther: boolean;
  locationDetails: string;
  dateLostOrFound: string;
  todayWat: string;
  fieldClass: string;
  customLocationRef: React.RefObject<HTMLInputElement | null>;
  onSelectOtherLocation: (clearSaved: boolean) => void;
  onSelectListedLocation: (value: string) => void;
  onChangeCustomLocation: (value: string) => void;
  onChangeDate: (value: string) => void;
  onChangeLocationDetails: (value: string) => void;
}

export const ReportLocationFields: React.FC<ReportLocationFieldsProps> = ({
  reportType,
  location,
  locationIsOther,
  locationDetails,
  dateLostOrFound,
  todayWat,
  fieldClass,
  customLocationRef,
  onSelectOtherLocation,
  onSelectListedLocation,
  onChangeCustomLocation,
  onChangeDate,
  onChangeLocationDetails,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label htmlFor="report-location" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
        Campus Location <span className="text-[#0F6E6E]">*</span>
      </label>
      <select
        id="report-location"
        required
        value={locationIsOther ? OTHER_LOCATION_VALUE : location}
        onChange={(e) => {
          const value = e.target.value;
          if (value === OTHER_LOCATION_VALUE) {
            onSelectOtherLocation(isListedLocation(location));
            window.setTimeout(() => customLocationRef.current?.focus(), 0);
            return;
          }
          onSelectListedLocation(value);
        }}
        className={`${fieldClass} pr-8 cursor-pointer`}
      >
        <option value="" disabled>Select campus location...</option>
        {NILE_LOCATION_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.locations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER_LOCATION_VALUE}>{OTHER_LOCATION_LABEL}</option>
      </select>
      {locationIsOther && (
        <div className="mt-2">
          <label htmlFor="report-location-custom" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
            Where was it? <span className="text-[#0F6E6E]">*</span>
          </label>
          <input
            ref={customLocationRef}
            id="report-location-custom"
            type="text"
            required
            maxLength={MAX_CUSTOM_LOCATION_LENGTH}
            value={location}
            onChange={(e) => onChangeCustomLocation(e.target.value.slice(0, MAX_CUSTOM_LOCATION_LENGTH))}
            autoComplete="off"
            placeholder="e.g. Faculty of Law corridor"
            aria-describedby="report-location-custom-help"
            className={fieldClass}
          />
          <p id="report-location-custom-help" className="mt-1 text-xs text-[#5C554C] dark:text-[#A8A095]">
            Type the building or place. Other students search by this name.
          </p>
        </div>
      )}
    </div>
    <div>
      <label htmlFor="report-date" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
        Date {reportType === 'lost' ? 'Lost' : 'Found'}
      </label>
      <input
        id="report-date"
        type="date"
        max={todayWat}
        value={dateLostOrFound}
        onChange={(e) => onChangeDate(e.target.value)}
        className={fieldClass}
        required
      />
    </div>
    <div className="sm:col-span-2">
      <label htmlFor="report-location-details" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
        Specific Spot <span className="text-sm font-normal text-[#5C554C] dark:text-[#A8A095]">(optional)</span>
      </label>
      <input
        id="report-location-details"
        type="text"
        value={locationDetails}
        onChange={(e) => onChangeLocationDetails(e.target.value.slice(0, 160))}
        placeholder="e.g. Room 205, Ground Floor Corridor"
        maxLength={160}
        className={fieldClass}
      />
    </div>
  </div>
);
