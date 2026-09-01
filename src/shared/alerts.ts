import Swal from 'sweetalert2'

// Centralized success/error confirmation modals used across the whole app -
// every save/edit/delete action should end in one of these so the user never
// has to guess whether an operation actually went through.

export function alertSuccess(message: string, title = 'Listo') {
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: '#e32636',
  })
}

export function alertError(message: string, title = 'Ocurrió un error') {
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: '#e32636',
  })
}
