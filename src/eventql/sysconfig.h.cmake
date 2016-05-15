/**
 * Copyright (c) 2016 zScale Technology GmbH <legal@zscale.io>
 * Authors:
 *   - Paul Asmuth <paul@zscale.io>
 *   - Christian Parpart <trapni@dawanda.com>
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License ("the license") as
 * published by the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * In accordance with Section 7(e) of the license, the licensing of the Program
 * under the license does not imply a trademark license. Therefore any rights,
 * title and interest in our trademarks remain entirely with us.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the license for more details.
 *
 * You can be released from the requirements of the license by purchasing a
 * commercial license. Buying such a license is mandatory as soon as you develop
 * commercial activities involving this program without disclosing the source
 * code of your own applications
 */
#ifndef libstx_sysconfig_h
#define libstx_sysconfig_h (1)

#cmakedefine LIBSTX_VERSION "@LIBSTX_VERSION@"

// --------------------------------------------------------------------------
// feature tests

// Build with inotify support
#cmakedefine STX_ENABLE_INOTIFY

#cmakedefine ENABLE_ACCEPT4
#cmakedefine ENABLE_PIPE2

#cmakedefine ENABLE_MULTI_ACCEPT

#cmakedefine ENABLE_PCRE

#cmakedefine ENABLE_INOTIFY

// Enable support for TCP_DEFER_ACCEPT
#cmakedefine ENABLE_TCP_DEFER_ACCEPT

// Try to open temporary files with O_TMPFILE flag before falling back
// to the standard behaviour.
#cmakedefine STX_ENABLE_O_TMPFILE

#cmakedefine STX_ENABLE_NOEXCEPT

// Builds with support for opportunistic write() calls to client sockets
#cmakedefine STX_OPPORTUNISTIC_WRITE 1

// --------------------------------------------------------------------------
// header tests

#cmakedefine HAVE_SYS_INOTIFY_H
#cmakedefine HAVE_SYS_SENDFILE_H
#cmakedefine HAVE_SYS_RESOURCE_H
#cmakedefine HAVE_SYS_LIMITS_H
#cmakedefine HAVE_SYS_MMAN_H
#cmakedefine HAVE_SYSLOG_H
#cmakedefine HAVE_DLFCN_H
#cmakedefine HAVE_EXECINFO_H
#cmakedefine HAVE_PWD_H
#cmakedefine HAVE_UNISTD_H
#cmakedefine HAVE_PTHREAD_H

#cmakedefine HAVE_NETDB_H
#cmakedefine HAVE_AIO_H
#cmakedefine HAVE_LIBAIO_H
#cmakedefine HAVE_ZLIB_H
#cmakedefine HAVE_BZLIB_H
#cmakedefine HAVE_GNUTLS_H
#cmakedefine HAVE_LUA_H
#cmakedefine HAVE_PCRE_H
#cmakedefine HAVE_PCRE
#cmakedefine HAVE_SYS_UTSNAME_H
#cmakedefine HAVE_SECURITY_PAM_APPL_H

#cmakedefine HASH_MAP_H @HASH_MAP_H@
#cmakedefine HASH_NAMESPACE @HASH_NAMESPACE@
#cmakedefine HASH_SET_H @HASH_SET_H@
#cmakedefine HAVE_HASH_MAP
#cmakedefine HAVE_HASH_SET
#cmakedefine HASH_MAP_CLASS @HASH_MAP_CLASS@
#cmakedefine HASH_SET_CLASS @HASH_SET_CLASS@

// --------------------------------------------------------------------------
// functional tests

#cmakedefine HAVE_INOTIFY_INIT1
#cmakedefine HAVE_CHROOT
#cmakedefine HAVE_PATHCONF
#cmakedefine HAVE_SENDFILE
#cmakedefine HAVE_POSIX_FADVISE
#cmakedefine HAVE_READAHEAD
#cmakedefine HAVE_PREAD
#cmakedefine HAVE_NANOSLEEP
#cmakedefine HAVE_DAEMON
#cmakedefine HAVE_SYSCONF
#cmakedefine HAVE_PATHCONF
#cmakedefine HAVE_ACCEPT4
#cmakedefine HAVE_PIPE2
#cmakedefine HAVE_DUP2
#cmakedefine HAVE_FORK
#cmakedefine HAVE_BACKTRACE
#cmakedefine HAVE_CLOCK_GETTIME
#cmakedefine HAVE_PTHREAD_SETNAME_NP
#cmakedefine HAVE_PTHREAD_SETAFFINITY_NP
#cmakedefine HAVE_GETHOSTBYNAME_R

#endif