"""
Inspect existing Companies, Locations, EmployeeLocations, and Geofence settings in PostgreSQL.
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from companies.models import Company
from employees.models import Employee
from time_tracking.models import Location, EmployeeLocation, TimeLog

def check_db_locations():
    print("=== DATABASE GEOFENCE & LOCATION AUDIT ===")
    companies = Company.objects.all()
    print(f"Total Companies: {companies.count()}")
    for comp in companies:
        print(f"\nCompany: {comp.company_name} (ID: {comp.id}, DisplayID: {comp.display_id})")
        print(f"  Geofence Enabled: {getattr(comp, 'geofence_enabled', True)}")
        
        locs = Location.objects.filter(company=comp)
        print(f"  Locations ({locs.count()}):")
        for loc in locs:
            print(f"    - [{loc.id}] {loc.name} (Type: {loc.geofence_type}, Lat: {loc.lat}, Lng: {loc.lng}, Radius: {loc.geofence_radius}m, Active: {loc.is_active})")
            
        emps = Employee.objects.filter(company=comp)
        print(f"  Employees ({emps.count()}):")
        for emp in emps:
            emp_locs = EmployeeLocation.objects.filter(employee=emp)
            assigned_names = [el.location.name for el in emp_locs]
            print(f"    - Employee: {emp.user.username if emp.user else emp.id} (ID: {emp.id}) -> Assigned Locs: {assigned_names if assigned_names else 'None (Uses Company Active Locations)'}")

if __name__ == "__main__":
    check_db_locations()
