import math
from io import BytesIO


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters using Haversine formula."""
    R = 6371000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def generate_shift_summary_pdf(time_log) -> bytes:
    """Generates a PDF summary report for a completed TimeLog."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except ImportError:
        raise RuntimeError("The 'reportlab' package is required for PDF generation. Please run 'pip install reportlab'.")

    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, 750, f"Shift Summary Report - Date: {time_log.work_date}")

    p.setFont("Helvetica", 12)
    emp_name = time_log.employee.user.get_full_name() if time_log.employee and time_log.employee.user else f"Employee #{time_log.employee_id}"
    p.drawString(50, 720, f"Employee: {emp_name}")
    p.drawString(50, 700, f"Clock In: {time_log.clock_in}")
    p.drawString(50, 680, f"Clock Out: {time_log.clock_out or 'N/A'}")
    p.drawString(50, 660, f"Location: {time_log.location.name if time_log.location else 'Unassigned'}")
    p.drawString(50, 640, f"Geofence Passed: {time_log.geofence_passed}")
    p.drawString(50, 620, f"Admin Override: {time_log.admin_override_used}")
    p.drawString(50, 600, f"Total Worked Seconds: {time_log.worked_seconds()}")
    p.drawString(50, 580, f"Total Break Seconds: {time_log.break_seconds()}")
    p.drawString(50, 560, f"Status: {time_log.status}")

    p.showPage()
    p.save()
    pdf_content = buffer.getvalue()
    buffer.close()
    return pdf_content
