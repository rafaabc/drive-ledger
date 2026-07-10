import { useState, useEffect } from 'react';
import { vehiclesApi } from '@/services/apiService.js';

/**
 * Loads the user's vehicles and, on create forms, defaults the vehicleId
 * field to the first vehicle once the list arrives.
 */
export function useVehicleOptions(isEdit, setForm) {
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    vehiclesApi
      .list()
      .then((list) => {
        setVehicles(list);
        if (!isEdit && list.length > 0) {
          setForm((f) => (f.vehicleId ? f : { ...f, vehicleId: list[0].id }));
        }
      })
      .catch(() => {});
  }, [isEdit, setForm]);

  return vehicles;
}
