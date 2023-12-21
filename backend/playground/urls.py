from django.urls import path
from . import views 
from .views import main_view,elon_page,coffe_page,cal_page

#urlConf
urlpatterns =[
    path('main/' ,views.main_view),
    path('elon/' ,views.elon_page),
    path('coffe/' ,views.coffe_page),
    path('cal/' ,views.cal_page)
]